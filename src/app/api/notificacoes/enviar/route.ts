import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hasServiceDb, serviceDb } from "@/lib/db/client";
import { digestMessage, type DigestItem } from "@/lib/email/messages";
import { hasEmailProvider, sendEmail, siteUrl } from "@/lib/email/send";
import { hasUnsubscribeSecret, unsubscribeToken } from "@/lib/unsubscribe";
import type { VotingObjectKind } from "@/lib/types";

/**
 * Envia as notificações vencidas.
 *
 * Chamada por agendador (a Vercel chama por GET com o segredo no cabeçalho),
 * nunca por gente. Cada chamada reserva até 50 assinantes, manda uma mensagem
 * para cada um com todas as votações vencidas dele, e marca o resultado.
 *
 * Sem provedor configurado não reserva nada: as notificações ficam pendentes
 * em vez de virar "falhou" por um motivo que não é delas.
 */

const MAX_SUBSCRIBERS = 50;
const MAX_ATTEMPTS = 5;
const PARALLEL = 5;

type Row = {
  id: string;
  subscriber_id: string;
  channel_id: string;
  voting_id: string;
  attempts: number;
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  // Sem segredo configurado a rota não roda: aberta, qualquer um dispararia
  // envio em massa.
  if (!authorized(request)) {
    return NextResponse.json({ error: "nao-autorizado" }, { status: 401 });
  }
  if (!hasServiceDb()) {
    return NextResponse.json({ error: "persistencia-indisponivel" }, { status: 503 });
  }
  if (!hasEmailProvider() || !hasUnsubscribeSecret()) {
    return NextResponse.json({ status: "sem-provedor", enviados: 0 });
  }

  const db = serviceDb();
  const base = siteUrl()!;

  const { data: claimed, error: claimError } = await db.rpc("claim_due_notifications", {
    max_subscribers: MAX_SUBSCRIBERS,
  });
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  const rows = (claimed ?? []) as Row[];
  if (rows.length === 0) return NextResponse.json({ status: "nada-a-enviar", enviados: 0 });

  const subscriberIds = [...new Set(rows.map((row) => row.subscriber_id))];
  const votingIds = [...new Set(rows.map((row) => row.voting_id))];
  const channelIds = [...new Set(rows.map((row) => row.channel_id))];

  // Tudo o que as mensagens precisam, em poucas consultas para o lote inteiro.
  const [subs, channels, votings, follows] = await Promise.all([
    db.from("subscribers").select("id, opted_out_at").in("id", subscriberIds),
    db.from("subscriber_channels").select("id, address, verified_at").in("id", channelIds),
    db
      .from("votings")
      .select(
        "id, occurred_at, object_kind, object_description, result, source_url, proposition:propositions(label, title)",
      )
      .in("id", votingIds),
    db
      .from("subscriber_legislators")
      .select("subscriber_id, legislator:legislators(id, name, party, uf)")
      .in("subscriber_id", subscriberIds),
  ]);
  const failed = [subs, channels, votings, follows].find((result) => result.error);
  if (failed?.error) {
    await release(rows.map((row) => row.id));
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  const legislatorIds = [
    ...new Set(
      (follows.data ?? []).map((row) => (row.legislator as unknown as { id: string }).id),
    ),
  ];
  const { data: votes, error: votesError } = await db
    .from("votes")
    .select("voting_id, legislator_id, value")
    .in("voting_id", votingIds)
    .in("legislator_id", legislatorIds);
  if (votesError) {
    await release(rows.map((row) => row.id));
    return NextResponse.json({ error: votesError.message }, { status: 500 });
  }

  const subById = new Map((subs.data ?? []).map((row) => [row.id as string, row]));
  const channelById = new Map((channels.data ?? []).map((row) => [row.id as string, row]));
  const votingById = new Map((votings.data ?? []).map((row) => [row.id as string, row]));
  const voteOf = new Map(
    (votes ?? []).map((row) => [`${row.voting_id}:${row.legislator_id}`, row.value as string]),
  );
  const followed = new Map<string, Array<{ id: string; name: string; party: string | null; uf: string | null }>>();
  for (const row of follows.data ?? []) {
    const list = followed.get(row.subscriber_id as string) ?? [];
    list.push(row.legislator as unknown as { id: string; name: string; party: string | null; uf: string | null });
    followed.set(row.subscriber_id as string, list);
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.subscriber_id, [...(groups.get(row.subscriber_id) ?? []), row]);

  const summary = { assinantes: groups.size, enviados: 0, falhas: 0, cancelados: 0 };

  async function deliver(subscriberId: string, group: Row[]) {
    const ids = group.map((row) => row.id);
    const sub = subById.get(subscriberId);
    const channel = channelById.get(group[0].channel_id);

    // Conferido de novo na hora de enviar, não só na geração: entre uma e
    // outra a pessoa pode ter saído da lista.
    if (!sub || sub.opted_out_at || !channel?.verified_at) {
      await db
        .from("notifications")
        .update({ state: "cancelada", claimed_at: null })
        .in("id", ids);
      summary.cancelados += 1;
      return;
    }

    const people = followed.get(subscriberId) ?? [];
    const items: DigestItem[] = group
      .map((row) => votingById.get(row.voting_id))
      .filter((voting): voting is NonNullable<typeof voting> => Boolean(voting))
      .map((voting) => {
        const proposition = voting.proposition as unknown as { label: string; title: string } | null;
        return {
          occurredAt: voting.occurred_at as string,
          propositionLabel: proposition?.label ?? null,
          propositionTitle: proposition?.title ?? null,
          objectKind: (voting.object_kind as VotingObjectKind | null) ?? null,
          objectDescription: voting.object_description as string,
          result: (voting.result as DigestItem["result"]) ?? null,
          sourceUrl: voting.source_url as string,
          votes: people.map((person) => {
            const value = voteOf.get(`${voting.id}:${person.id}`);
            return {
              name: person.name,
              party: person.party,
              uf: person.uf,
              // `undefined` é ausência de registro; string vazia é registro sem
              // valor. Os dois casos são distintos (PRD §8.1).
              value: value === undefined ? null : value,
            };
          }),
        };
      });

    const message = digestMessage({
      to: channel.address as string,
      items,
      siteUrl: base,
      unsubscribeUrl: `${base}/descadastrar?t=${encodeURIComponent(unsubscribeToken(subscriberId))}`,
    });
    const oneClick = `${base}/api/descadastrar?t=${encodeURIComponent(unsubscribeToken(subscriberId))}`;
    const sent = await sendEmail({
      ...message,
      headers: {
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      // Mesmas linhas, mesma chave: um reenvio depois de queda é descartado
      // pelo provedor em vez de virar segundo e-mail.
      idempotencyKey: createHash("sha256").update([...ids].sort().join(",")).digest("hex"),
    });

    if (sent.status === "enviado") {
      await db
        .from("notifications")
        .update({ state: "enviada", sent_at: new Date().toISOString(), claimed_at: null, error: null })
        .in("id", ids);
      summary.enviados += 1;
      return;
    }

    if (sent.status === "sem-provedor") {
      await release(ids);
      return;
    }

    // Falha: volta para a fila com espera crescente; depois de cinco
    // tentativas, desiste e registra o motivo.
    summary.falhas += 1;
    for (const row of group) {
      const attempts = row.attempts + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await db
        .from("notifications")
        .update({
          attempts,
          claimed_at: null,
          error: sent.reason.slice(0, 500),
          ...(giveUp
            ? { state: "falhou" }
            : {
                scheduled_for: new Date(
                  Date.now() + 5 * 60_000 * 2 ** (attempts - 1),
                ).toISOString(),
              }),
        })
        .eq("id", row.id);
    }
  }

  const entries = [...groups.entries()];
  for (let index = 0; index < entries.length; index += PARALLEL) {
    await Promise.all(
      entries.slice(index, index + PARALLEL).map(([subscriberId, group]) =>
        deliver(subscriberId, group).catch(async (error) => {
          console.error(`[observa] envio para ${subscriberId}:`, error);
          await release(group.map((row) => row.id));
        }),
      ),
    );
  }

  return NextResponse.json(summary);

  async function release(ids: string[]) {
    await db.from("notifications").update({ claimed_at: null }).in("id", ids);
  }
}

export const GET = handle;
export const POST = handle;
