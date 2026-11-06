import { NextResponse } from "next/server";
import { hasServiceDb } from "@/lib/db/client";
import { upsertSubscription } from "@/lib/db/subscriptions";
import { isValidEmail, type Frequency } from "@/lib/preferences";
import { TOPICS } from "@/lib/topics";
import type { TopicId } from "@/lib/types";

const FREQUENCIES: Frequency[] = ["imediato", "diario", "semanal"];
const TOPIC_IDS = TOPICS.map((topic) => topic.id);

type Body = {
  email?: unknown;
  frequency?: unknown;
  legislators?: unknown;
  topics?: unknown;
};

/**
 * Grava a inscrição e cria o link mágico de confirmação.
 *
 * Nada é enviado até existir um provedor de e-mail configurado. Quando não há,
 * a resposta diz isso explicitamente (`emailSent: false`) em vez de a
 * interface afirmar que mandou uma mensagem que nunca saiu.
 */
export async function POST(request: Request) {
  if (!hasServiceDb()) {
    return NextResponse.json(
      {
        error: "persistencia-indisponivel",
        message:
          "O banco ainda não aceita escrita: falta SUPABASE_SERVICE_ROLE_KEY no ambiente.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "json-invalido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "email-invalido" }, { status: 400 });
  }

  const frequency = FREQUENCIES.includes(body.frequency as Frequency)
    ? (body.frequency as Frequency)
    : "semanal";

  const legislators = Array.isArray(body.legislators)
    ? body.legislators
        .map((item) => (item as { externalId?: unknown }).externalId)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .slice(0, 5)
        .map((externalId) => ({ house: "camara", externalId }))
    : [];

  if (legislators.length === 0) {
    return NextResponse.json({ error: "sem-parlamentares" }, { status: 400 });
  }

  const topics = Array.isArray(body.topics)
    ? (body.topics.filter(
        (id): id is TopicId => typeof id === "string" && TOPIC_IDS.includes(id as TopicId),
      ) as TopicId[])
    : [];

  try {
    const result = await upsertSubscription({ email, frequency, legislators, topics });

    const emailProviderConfigured = Boolean(process.env.RESEND_API_KEY);
    if (emailProviderConfigured) {
      // TODO(fase 4): enviar o e-mail de confirmação com o link mágico.
    } else {
      // O token é um segredo: nunca volta para o cliente. Em desenvolvimento
      // fica no log do servidor para dar para testar a confirmação.
      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[observa] ${result.purpose} em /confirmar?token=${result.token}`,
        );
      }
    }

    // A resposta é a mesma para endereço novo, endereço pendente e endereço já
    // confirmado. Dizer qual é o caso deixaria sondar quem usa o Observa: era
    // o que `alreadyVerified` fazia antes de sair daqui.
    return NextResponse.json({ ok: true, emailSent: emailProviderConfigured });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: "falha-ao-gravar", message },
      { status: 500 },
    );
  }
}
