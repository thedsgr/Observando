import { NextResponse } from "next/server";
import { hasServiceDb } from "@/lib/db/client";
import { TOKEN_TTL_HOURS, upsertSubscription } from "@/lib/db/subscriptions";
import { applyMessage, verifyMessage } from "@/lib/email/messages";
import { sendEmail, siteUrl } from "@/lib/email/send";
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

    const url = `${siteUrl() ?? ""}/confirmar?token=${result.token}`;
    const context = {
      to: result.address,
      url,
      ttlHours: TOKEN_TTL_HOURS,
      legislators: result.legislatorNames,
      topics,
      frequency,
    };
    const sent = await sendEmail(
      result.purpose === "apply" ? applyMessage(context) : verifyMessage(context),
    );

    if (sent.status === "falhou") {
      // Falha de envio é problema de operação, não do pedido: a inscrição já
      // está gravada e o link continua válido para uma nova tentativa.
      console.error(`[observa] envio falhou: ${sent.reason}`);
    }
    if (sent.status !== "enviado" && process.env.NODE_ENV !== "production") {
      // O token é um segredo: nunca volta para o cliente. Enquanto não há
      // mensagem saindo, o link fica no log do servidor para dar para testar.
      console.info(`[observa] ${result.purpose} em ${url}`);
    }

    // `delivery` descreve o envio, nunca o assinante: endereço novo, pendente
    // e já confirmado respondem igual. Dizer qual é o caso deixaria sondar
    // quem usa o Observa — era o que `alreadyVerified` fazia antes de sair.
    return NextResponse.json({
      ok: true,
      emailSent: sent.status === "enviado",
      delivery: sent.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: "falha-ao-gravar", message },
      { status: 500 },
    );
  }
}
