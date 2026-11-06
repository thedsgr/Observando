import { NextResponse } from "next/server";
import { hasServiceDb } from "@/lib/db/client";
import { confirmDeletion } from "@/lib/db/subscriptions";

/**
 * Exclusão de fato. Só por POST: filtros de segurança abrem os links dos
 * e-mails, e abrir não pode bastar para apagar os dados de ninguém.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = form?.get("t");
  const troca = form?.get("troca") === "1" ? "&troca=1" : "";
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/apagar?${query}${troca}`, url), 303);

  if (typeof token !== "string" || !token || !hasServiceDb()) return back("erro=1");
  const done = await confirmDeletion(token).catch(() => false);
  return back(done ? "feito=1" : "erro=1");
}
