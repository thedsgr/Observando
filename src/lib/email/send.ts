import "server-only";

/**
 * Envio de e-mail.
 *
 * Chamada direta à API do provedor, sem SDK: é um endpoint só, e uma
 * dependência a menos é uma superfície a menos para uma mensagem que carrega
 * link de autenticação.
 *
 * O resultado é explícito em vez de booleano porque "não enviei" tem três
 * causas distintas e a interface precisa dizer qual foi: provedor ausente é
 * ambiente incompleto, falha é problema a investigar, e as duas são diferentes
 * de ter enviado.
 */

const ENDPOINT = "https://api.resend.com/emails";

/**
 * Em desenvolvimento, o endereço do provedor pode apontar para um servidor
 * local que só registra o pedido — é como o caminho de sucesso do envio é
 * testado sem mandar e-mail a ninguém. Em produção a variável é ignorada: um
 * valor errado ali mandaria a chave do provedor para outro servidor.
 */
function endpoint(): string {
  const override = process.env.OBSERVA_EMAIL_ENDPOINT?.trim();
  return override && process.env.NODE_ENV !== "production" ? override : ENDPOINT;
}

/** Aborta em vez de prender a resposta da inscrição num provedor pendurado. */
const TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Cabeçalhos do e-mail, como `List-Unsubscribe`. */
  headers?: Record<string, string>;
  /**
   * Repetir o envio com a mesma chave não gera um segundo e-mail: o provedor
   * reconhece e descarta. É o que torna seguro tentar de novo depois de uma
   * queda entre enviar e registrar que enviou.
   */
  idempotencyKey?: string;
};

export type SendResult =
  | { status: "enviado"; id: string | null }
  | { status: "sem-provedor"; missing: string[] }
  | { status: "falhou"; reason: string };

/**
 * Endereço de origem e URL pública são tão obrigatórios quanto a chave: sem o
 * remetente o provedor recusa, e sem a URL o link do e-mail não resolve.
 */
function missingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.OBSERVA_EMAIL_FROM) missing.push("OBSERVA_EMAIL_FROM");
  if (!siteUrl()) missing.push("OBSERVA_SITE_URL");
  return missing;
}

export function hasEmailProvider(): boolean {
  return missingConfig().length === 0;
}

/**
 * Base para montar links absolutos. Em desenvolvimento cai no servidor local;
 * em produção não há palpite seguro, então a ausência desabilita o envio.
 */
export function siteUrl(): string | null {
  const configured = process.env.OBSERVA_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const missing = missingConfig();
  if (missing.length > 0) return { status: "sem-provedor", missing };

  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.OBSERVA_EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "erro de rede";
    return { status: "falhou", reason };
  }

  if (!response.ok) {
    // Corpo truncado: serve para diagnosticar sem despejar resposta inteira de
    // terceiro no log. A chave nunca entra aqui — ela só existe no cabeçalho.
    const body = await response.text().catch(() => "");
    return {
      status: "falhou",
      reason: `${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return { status: "enviado", id: payload?.id ?? null };
}
