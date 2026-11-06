import { NextResponse } from "next/server";
import { hasServiceDb, serviceDb } from "@/lib/db/client";
import { readUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * Descadastro. Só por POST, nunca por GET.
 *
 * Filtros de segurança de e-mail abrem todos os links de uma mensagem para
 * inspecioná-los. Se abrir o link bastasse para descadastrar, gente seria
 * descadastrada sem ter clicado em nada. Por isso o link do corpo leva a uma
 * página com botão, e a ação acontece aqui.
 *
 * Atende também o descadastro em um clique dos provedores (RFC 8058): o
 * cabeçalho `List-Unsubscribe-Post` faz o Gmail e outros chamarem esta rota
 * por POST com `List-Unsubscribe=One-Click` no corpo.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = (form?.get("t") as string | null) ?? url.searchParams.get("t");
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const subscriberId = readUnsubscribeToken(token);

  const back = (query: string) =>
    NextResponse.redirect(new URL(`/descadastrar?${query}`, url), 303);

  if (!subscriberId || !hasServiceDb()) {
    return oneClick
      ? new NextResponse("link inválido", { status: 400 })
      : back("erro=1");
  }

  const db = serviceDb();
  const now = new Date().toISOString();
  // `is null`: descadastrar de novo não reescreve a data da primeira saída.
  const { error } = await db
    .from("subscribers")
    .update({ opted_out_at: now })
    .eq("id", subscriberId)
    .is("opted_out_at", null);
  // O que já estava na fila não sai: quem pediu para parar não recebe nem o
  // resumo que estava agendado para amanhã.
  const { error: queueError } = await db
    .from("notifications")
    .update({ state: "cancelada" })
    .eq("subscriber_id", subscriberId)
    .eq("state", "pendente");

  if (error || queueError) {
    return oneClick ? new NextResponse("erro", { status: 500 }) : back("erro=1");
  }
  return oneClick ? new NextResponse("ok") : back("feito=1");
}
