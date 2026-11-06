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
 *
 * Disso decorre a regra central deste módulo: um canal já verificado pertence
 * a alguém que provou ter acesso ao endereço, e nada nas preferências dele é
 * alterado por um pedido que não traga a mesma prova. Um pedido desses não
 * grava: deixa a mudança pendente no token e espera o clique.
 */

type Db = ReturnType<typeof serviceDb>;

type TokenPurpose = "verify" | "apply";

export type SubscriptionInput = {
  email: string;
  frequency: Frequency;
  legislators: Array<{ house: string; externalId: number }>;
  topics: TopicId[];
};

/** Preferências já resolvidas para ids internos, prontas para gravar. */
type Preferences = {
  legislatorIds: string[];
  topics: TopicId[];
  frequency: Frequency;
};

export type SubscriptionResult = {
  /** Token em claro. Só existe aqui e no e-mail; o banco guarda o hash. */
  token: string;
  /**
   * O que o clique vai fazer. Fica no servidor: devolver isso ao cliente
   * revelaria se um endereço qualquer já é assinante confirmado, que é
   * exatamente o que não queremos que dê para sondar.
   */
  purpose: TokenPurpose;
};

const TOKEN_TTL_HOURS = 48;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Traduz ids oficiais para ids internos.
 *
 * Só leitura, então roda também no caminho que não grava — a validação precisa
 * acontecer antes de qualquer escrita, e o erro precisa chegar a quem pediu.
 */
async function resolvePreferences(
  db: Db,
  input: SubscriptionInput,
): Promise<Preferences> {
  const externalIds = input.legislators.map((item) => String(item.externalId));
  const { data: rows, error } = await db
    .from("legislators")
    .select("id, external_id")
    .eq("house_id", "camara")
    .in("external_id", externalIds);
  if (error) throw new Error(`Falha ao ler parlamentares: ${error.message}`);

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

  return {
    legislatorIds: found.map((row) => row.id as string),
    topics: input.topics,
    frequency: input.frequency,
  };
}

/**
 * Substitui o conjunto inteiro de preferências.
 *
 * Idempotente de propósito: apagar e reinserir deixa aplicar duas vezes com o
 * mesmo resultado, o que torna seguro aplicar antes de fechar o token.
 */
async function applyPreferences(
  db: Db,
  subscriberId: string,
  channelId: string,
  preferences: Preferences,
): Promise<void> {
  await db.from("subscriber_legislators").delete().eq("subscriber_id", subscriberId);
  if (preferences.legislatorIds.length > 0) {
    const { error } = await db.from("subscriber_legislators").insert(
      preferences.legislatorIds.map((legislatorId) => ({
        subscriber_id: subscriberId,
        legislator_id: legislatorId,
      })),
    );
    if (error) throw new Error(`Falha ao gravar parlamentares: ${error.message}`);
  }

  // Nenhuma linha significa "todos os temas".
  await db.from("subscriber_topics").delete().eq("subscriber_id", subscriberId);
  if (preferences.topics.length > 0) {
    const { error } = await db.from("subscriber_topics").insert(
      preferences.topics.map((topicId) => ({
        subscriber_id: subscriberId,
        topic_id: topicId,
      })),
    );
    if (error) throw new Error(`Falha ao gravar temas: ${error.message}`);
  }

  const { error } = await db.from("subscriber_settings").upsert(
    {
      subscriber_id: subscriberId,
      frequency: preferences.frequency,
      channel_id: channelId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subscriber_id" },
  );
  if (error) throw new Error(`Falha ao gravar a frequência: ${error.message}`);
}

async function issueToken(
  db: Db,
  args: {
    subscriberId: string;
    channelId: string;
    purpose: TokenPurpose;
    payload: Preferences | null;
  },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("magic_tokens").insert({
    token_hash: hashToken(token),
    subscriber_id: args.subscriberId,
    channel_id: args.channelId,
    purpose: args.purpose,
    payload: args.payload,
    expires_at: new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString(),
  });
  if (error) throw new Error(`Falha ao criar o link: ${error.message}`);
  return token;
}

/**
 * Registra o pedido de inscrição e devolve o link mágico.
 *
 * Dois caminhos, e a diferença entre eles é quem já provou ter o endereço:
 *
 * - canal já verificado: nada é gravado. A mudança fica no token e o clique a
 *   aplica. Sem isso, digitar o e-mail de outra pessoa reescreveria as
 *   preferências dela, e reabriria a assinatura de quem cancelou;
 * - canal novo ou nunca confirmado: aplica direto, porque não há preferência
 *   confirmada de ninguém para proteger e nada é enviado antes do clique.
 */
export async function upsertSubscription(
  input: SubscriptionInput,
): Promise<SubscriptionResult> {
  const db = serviceDb();
  const address = normalizeEmail(input.email);

  const { data: existingChannel } = await db
    .from("subscriber_channels")
    .select("id, subscriber_id, verified_at")
    .eq("kind", "email")
    .eq("address", address)
    .maybeSingle();

  // Antes de decidir o caminho: validar. Vale para os dois, e é só leitura.
  const preferences = await resolvePreferences(db, input);

  if (existingChannel?.verified_at) {
    return {
      token: await issueToken(db, {
        subscriberId: existingChannel.subscriber_id as string,
        channelId: existingChannel.id as string,
        purpose: "apply",
        payload: preferences,
      }),
      purpose: "apply",
    };
  }

  let subscriberId = existingChannel?.subscriber_id as string | undefined;
  let channelId = existingChannel?.id as string | undefined;

  if (!subscriberId || !channelId) {
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
  }

  // `opted_out_at` não é limpo aqui de propósito: sair da lista só se desfaz
  // com a confirmação, senão qualquer pessoa reativaria o envio para um
  // endereço que pediu para não receber mais nada.
  await applyPreferences(db, subscriberId, channelId, preferences);

  return {
    token: await issueToken(db, {
      subscriberId,
      channelId,
      purpose: "verify",
      payload: null,
    }),
    purpose: "verify",
  };
}

export type Confirmation =
  /** Primeira confirmação do endereço: a partir daqui pode receber. */
  | { status: "confirmado" }
  /** Mudança de preferências que estava pendente e acabou de valer. */
  | { status: "atualizado" }
  /** Inexistente, expirado ou já usado — os três respondem igual. */
  | { status: "invalido" };

/**
 * Consome o token recebido por e-mail.
 *
 * O token é tomado com um único UPDATE condicionado a `used_at is null`, para
 * que dois cliques simultâneos não apliquem a mesma mudança duas vezes. Se a
 * aplicação falhar depois disso, a marca é desfeita: é melhor o link continuar
 * valendo do que a pessoa ficar com um link morto e a mudança perdida.
 */
export async function confirmToken(token: string): Promise<Confirmation> {
  const db = serviceDb();
  const now = new Date().toISOString();

  const { data: claimed } = await db
    .from("magic_tokens")
    .update({ used_at: now })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("token_hash, subscriber_id, channel_id, purpose, payload")
    .maybeSingle();

  if (!claimed) return { status: "invalido" };

  const purpose = claimed.purpose as TokenPurpose;
  const subscriberId = claimed.subscriber_id as string;
  const channelId = claimed.channel_id as string;

  try {
    if (purpose === "apply") {
      await applyPreferences(
        db,
        subscriberId,
        channelId,
        claimed.payload as Preferences,
      );
    }

    // Confirmar é ato de quem tem o endereço, então é também o único momento
    // em que uma saída da lista pode ser desfeita.
    await db
      .from("subscribers")
      .update({ opted_out_at: null, consented_at: now })
      .eq("id", subscriberId);
    await db
      .from("subscriber_channels")
      .update({ verified_at: now })
      .eq("id", channelId)
      .is("verified_at", null);

    return { status: purpose === "apply" ? "atualizado" : "confirmado" };
  } catch (error) {
    await db
      .from("magic_tokens")
      .update({ used_at: null })
      .eq("token_hash", claimed.token_hash as string);
    throw error;
  }
}
