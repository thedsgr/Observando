import Link from "next/link";
import { confirmToken, type Confirmation } from "@/lib/db/subscriptions";
import { hasServiceDb } from "@/lib/db/client";
import { Logo } from "@/components/ui/logo";

export const metadata = { title: "Confirmação — Observando" };

/**
 * Destino do link mágico. O clique é o que autoriza: confirma o canal no
 * primeiro cadastro e, depois dele, é também o que faz uma mudança de
 * preferências valer — sem ele ninguém altera a inscrição de outra pessoa.
 */
const COPY: Record<Confirmation["status"], { title: string; body: string }> = {
  confirmado: {
    title: "E-mail confirmado",
    body:
      "Pronto. A partir de agora você recebe os avisos das votações dos parlamentares que escolheu, na frequência que pediu.",
  },
  atualizado: {
    title: "Preferências atualizadas",
    body:
      "Suas escolhas novas já valem. Os próximos avisos seguem os parlamentares, temas e a frequência que você acabou de confirmar.",
  },
  invalido: {
    title: "Não foi possível confirmar",
    body:
      "O link pode ter expirado, já ter sido usado ou estar incompleto. Se você pediu de novo depois, só o e-mail mais recente vale. Refaça a inscrição para receber um link novo.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result: Confirmation =
    hasServiceDb() && token
      ? await confirmToken(token).catch(() => ({ status: "invalido" }) as const)
      : { status: "invalido" };

  const copy = COPY[result.status];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <p>
        <Logo />
      </p>
      <h1 className="mt-5 font-serif text-3xl leading-tight text-text">
        {copy.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
        {copy.body}
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
