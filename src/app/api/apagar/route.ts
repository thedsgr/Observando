import { NextResponse } from "next/server";
import { hasServiceDb } from "@/lib/db/client";
import { RATE_LIMITED_MESSAGE, allowEmailRequest } from "@/lib/db/rate-limit";
import { TOKEN_TTL_HOURS, requestDeletion } from "@/lib/db/subscriptions";
import { deletionMessage } from "@/lib/email/messages";
import { hasEmailProvider, sendEmail, siteUrl } from "@/lib/email/send";
import { isValidEmail } from "@/lib/preferences";

/**
 * Pedido de exclusão. Não apaga nada: manda o link para o endereço.
 *
 * A resposta é a mesma haja ou não inscrição com o endereço — do contrário a
 * tela de exclusão viraria um jeito de descobrir quem usa o Observando. Quando
 * não há inscrição, nada é enviado, e a tela diz "se houver".
 */
export async function POST(request: Request) {
  if (!hasServiceDb()) {
    return NextResponse.json({ error: "persistencia-indisponivel" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "email-invalido" }, { status: 400 });
  }

  // Vale para qualquer endereço, inscrito ou não, então a recusa não diz
  // nada sobre quem usa o Observando.
  if (!(await allowEmailRequest(request, [email.trim().toLowerCase()]))) {
    return NextResponse.json(
      { error: "muitos-pedidos", message: RATE_LIMITED_MESSAGE },
      { status: 429 },
    );
  }

  const pending = await requestDeletion(email);
  if (!pending) {
    return NextResponse.json({
      ok: true,
      delivery: hasEmailProvider() ? "enviado" : "sem-provedor",
    });
  }

  const url = `${siteUrl() ?? ""}/apagar?t=${encodeURIComponent(pending.token)}`;
  const sent = await sendEmail(
    deletionMessage({ to: pending.address, url, ttlHours: TOKEN_TTL_HOURS }),
  );
  if (sent.status === "falhou") console.error(`[observa] envio falhou: ${sent.reason}`);
  if (sent.status !== "enviado" && process.env.NODE_ENV !== "production") {
    console.info(`[observa] delete em ${url}`);
  }
  return NextResponse.json({ ok: true, delivery: sent.status });
}
