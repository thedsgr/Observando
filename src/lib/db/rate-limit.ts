import "server-only";
import { createHash } from "node:crypto";
import { serviceDb } from "@/lib/db/client";

/**
 * Limite de pedidos que fazem sair e-mail.
 *
 * Dois baldes: o endereço que recebe a mensagem e o IP de quem pede. O do
 * endereço protege a vítima de quem quer encher a caixa dela; o do IP segura
 * quem varre muitos endereços diferentes. Inscrição e exclusão dividem os
 * mesmos baldes, porque o que se limita é mensagem chegando ao endereço, não
 * a rota que a mandou.
 *
 * Cada salvamento no editor manda um link, então o limite por endereço tem
 * folga para quem ajusta as escolhas algumas vezes seguidas.
 */

const LIMITS = {
  emailPerHour: 5,
  emailPerDay: 10,
  ipPerHour: 20,
};

export const RATE_LIMITED_MESSAGE =
  "Muitos pedidos seguidos. Espere um pouco e tente de novo.";

function bucket(kind: string, value: string): string {
  return `${kind}:${createHash("sha256").update(`${kind}:${value}`).digest("hex")}`;
}

/**
 * IP de quem chamou. Na Vercel, `x-real-ip` é posto pela própria plataforma;
 * o primeiro item de `x-forwarded-for` fica de reserva (o `next dev` o
 * preenche com o endereço local). Sem nenhum dos dois, o balde de IP não se
 * aplica.
 */
function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

/**
 * Registra o pedido e diz se ele pode seguir. Os endereços já chegam
 * normalizados por quem chama.
 *
 * Falha do banco deixa passar: o limite existe contra abuso, e derrubar toda
 * inscrição porque o contador caiu puniria só quem usa direito.
 */
export async function allowEmailRequest(
  request: Request,
  addresses: string[],
): Promise<boolean> {
  const buckets: string[] = [];
  const limits: number[] = [];
  const windows: string[] = [];

  for (const address of new Set(addresses)) {
    const key = bucket("email", address);
    buckets.push(key, key);
    limits.push(LIMITS.emailPerHour, LIMITS.emailPerDay);
    windows.push("1 hour", "1 day");
  }
  const ip = clientIp(request);
  if (ip) {
    buckets.push(bucket("ip", ip));
    limits.push(LIMITS.ipPerHour);
    windows.push("1 hour");
  }

  const { data, error } = await serviceDb().rpc("registrar_pedido", {
    p_buckets: buckets,
    p_limits: limits,
    p_windows: windows,
  });
  if (error) {
    console.error(`[observa] limite de pedidos indisponível: ${error.message}`);
    return true;
  }
  return data === true;
}
