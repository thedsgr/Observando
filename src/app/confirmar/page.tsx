import Link from "next/link";
import { verifyToken } from "@/lib/db/subscriptions";
import { hasServiceDb } from "@/lib/db/client";

export const metadata = { title: "Confirmação — Observa" };

/**
 * Destino do link mágico. Confirmar o canal é o que materializa o
 * consentimento: antes disso a inscrição existe, mas não recebe nada.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const confirmed =
    hasServiceDb() && token ? await verifyToken(token).catch(() => false) : false;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <p className="font-serif text-lg text-text">Observa</p>
      <h1 className="mt-5 font-serif text-3xl leading-tight text-text">
        {confirmed ? "E-mail confirmado" : "Não foi possível confirmar"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
        {confirmed
          ? "Pronto. A partir de agora você recebe os avisos das votações dos parlamentares que escolheu, na frequência que pediu."
          : "O link pode ter expirado, já ter sido usado ou estar incompleto. Refaça a inscrição para receber um novo."}
      </p>
      <Link
        href="/"
        className="mt-7 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
      >
        Ir para o painel
      </Link>
    </main>
  );
}
