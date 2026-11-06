import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link de descadastro.
 *
 * O token é o id do assinante assinado com HMAC. Não fica guardado no banco e
 * não expira — descadastro precisa funcionar com um e-mail de meses atrás — e
 * sem o segredo não dá para montar o link de outra pessoa.
 *
 * Segredo próprio, não reaproveitado de outra chave: quem o tiver consegue
 * descadastrar qualquer um, e nada mais. Trocá-lo invalida todos os links já
 * enviados, então é para ser estável.
 */

const PREFIX = "descadastro:v1:";

function secret(): string | null {
  return process.env.OBSERVA_UNSUBSCRIBE_SECRET?.trim() || null;
}

export function hasUnsubscribeSecret(): boolean {
  return secret() !== null;
}

function sign(subscriberId: string, key: string): string {
  return createHmac("sha256", key).update(PREFIX + subscriberId).digest("base64url");
}

export function unsubscribeToken(subscriberId: string): string {
  const key = secret();
  if (!key) throw new Error("OBSERVA_UNSUBSCRIBE_SECRET não configurado");
  return `${subscriberId}.${sign(subscriberId, key)}`;
}

/** Devolve o id do assinante se o token for autêntico; `null` caso contrário. */
export function readUnsubscribeToken(token: string | null | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const subscriberId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(subscriberId, key));
  // Comparação em tempo constante: diferença de tempo vazaria a assinatura.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return subscriberId;
}
