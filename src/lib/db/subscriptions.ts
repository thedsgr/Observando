import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serviceDb } from "@/lib/db/client";
import type { Frequency } from "@/lib/preferences";
import type { TopicId } from "@/lib/types";

/**
 * Gravação da inscrição.
 *
 * Modelo sem conta e sem senha: a identidade é um canal verificado. A
 * inscrição nasce com `verified_at` nulo e **não recebe nada** até o link
 * mágico ser usado — é a confirmação que materializa o consentimento exigido
 * pelo PRD §8.4, não o clique no botão do onboarding.
 */

export type SubscriptionInput = {
  email: string;
  frequency: Frequency;
  legislators: Array<{ house: string; externalId: number }>;
  topics: TopicId[];
};

export type SubscriptionResult = {
  subscriberId: string;
  /** Token em claro. Só existe aqui e no e-mail; o banco guarda o hash. */
  verifyToken: string;
  alreadyVerified: boolean;
};

const TOKEN_TTL_HOURS = 48;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria ou atualiza a inscrição de um e-mail.
 *
 * Reinscrever com o mesmo e-mail substitui as preferências em vez de criar um
 * segundo assinante: do contrário a pessoa receberia mensagens duplicadas sem
 * ter como cancelar as duas.
 */
export async function upsertSubscription(
  input: SubscriptionInput,
): Promise<SubscriptionResult> {
  const db = serviceDb();
  const address = input.email.trim().toLowerCase();

  // 1. O canal é a chave natural: (kind, address) é único.
  const { data: existingChannel } = await db
    .from("subscriber_channels")
    .select("id, subscriber_id, verified_at")
    .eq("kind", "email")
    .eq("address", address)
    .maybeSingle();

  let subscriberId = existingChannel?.subscriber_id as string | undefined;
  let channelId = existingChannel?.id as string | undefined;

  if (!subscriberId) {
    const { data: subscriber, error } = await db
      .from("subscribers")
      .insert({ consented_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar assinante: ${error.message}`);
    subscriberId = subscriber.id as string;

    const { data: channel, error: channelError } = await db
      .from("subscriber_channels")
      .insert({ subscriber_id: subscriberId, kind: "email", address })
      .select("id")
      .single();
    if (channelError) {
      throw new Error(`Falha ao registrar o e-mail: ${channelError.message}`);
    }
    channelId = channel.id as string;
  } else {
    // Reinscrição de quem havia cancelado reabre a assinatura.
    await db
      .from("subscribers")
      .update({ opted_out_at: null, consented_at: new Date().toISOString() })
      .eq("id", subscriberId);
  }

  // 2. Parlamentares acompanhados. Trocamos o conjunto inteiro: é o que a
  //    tela de preferências representa.
  const externalIds = input.legislators.map((item) => String(item.externalId));
  const { data: rows, error: legislatorError } = await db
    .from("legislators")
    .select("id, external_id")
    .eq("house_id", "camara")
    .in("external_id", externalIds);
  if (legislatorError) {
    throw new Error(`Falha ao ler parlamentares: ${legislatorError.message}`);
  }

  const found = rows ?? [];
  if (found.length !== externalIds.length) {
    // Acontece se a sincronização ainda não rodou. Gravar metade seria pior:
    // a pessoa acharia que acompanha alguém que o sistema não conhece.
    const missing = externalIds.filter(
      (id) => !found.some((row) => row.external_id === id),
    );
    throw new Error(
      `Parlamentares ausentes na base: ${missing.join(", ")}. Rode a sincronização antes.`,
    );
  }

  await db.from("subscriber_legislators").delete().eq("subscriber_id", subscriberId);
  await db.from("subscriber_legislators").insert(
    found.map((row) => ({ subscriber_id: subscriberId, legislator_id: row.id })),
  );

  // 3. Temas. Nenhuma linha significa "todos".
  await db.from("subscriber_topics").delete().eq("subscriber_id", subscriberId);
  if (input.topics.length > 0) {
    await db.from("subscriber_topics").insert(
      input.topics.map((topicId) => ({
        subscriber_id: subscriberId,
        topic_id: topicId,
      })),
    );
  }

  // 4. Frequência e canal preferido.
  await db.from("subscriber_settings").upsert(
    {
      subscriber_id: subscriberId,
      frequency: input.frequency,
      channel_id: channelId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subscriber_id" },
  );

  // 5. Link mágico de confirmação. O banco guarda só o hash.
  const verifyToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
  await db.from("magic_tokens").insert({
    token_hash: hashToken(verifyToken),
    subscriber_id: subscriberId,
    channel_id: channelId,
    purpose: "verify",
    expires_at: expiresAt.toISOString(),
  });

  return {
    subscriberId,
    verifyToken,
    alreadyVerified: Boolean(existingChannel?.verified_at),
  };
}

/** Confirma um canal a partir do token em claro recebido por e-mail. */
export async function verifyToken(token: string): Promise<boolean> {
  const db = serviceDb();
  const { data: row } = await db
    .from("magic_tokens")
    .select("token_hash, channel_id, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .eq("purpose", "verify")
    .maybeSingle();

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return false;

  await db
    .from("subscriber_channels")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.channel_id);
  await db
    .from("magic_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", row.token_hash);

  return true;
}
