import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata = { title: "Parar de receber — Observando" };

/**
 * Página de destino do link de descadastro. Não descadastra ao abrir — ver o
 * motivo em `api/descadastrar/route.ts` — só mostra o botão.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; feito?: string; erro?: string }>;
}) {
  const { t, feito, erro } = await searchParams;

  const [title, body] = feito
    ? [
        "Pronto, você não recebe mais avisos",
        "Nenhuma mensagem nova será enviada, nem as que já estavam agendadas. Se mudar de ideia, é só se inscrever de novo pelo site.",
      ]
    : erro || !t
      ? [
          "Não foi possível concluir",
          "O link parece incompleto. Abra de novo o link do último e-mail que você recebeu.",
        ]
      : [
          "Parar de receber avisos?",
          "Você deixa de receber os e-mails do Observando sobre as votações dos parlamentares que acompanha.",
        ];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <p>
        <Logo />
      </p>
      <h1 className="mt-5 font-serif text-3xl leading-tight text-text">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">{body}</p>
      {!feito && !erro && t ? (
        <form method="post" action="/api/descadastrar" className="mt-7">
          <input type="hidden" name="t" value={t} />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
          >
            Parar de receber
          </button>
        </form>
      ) : (
        <Link
          href="/"
          className="mt-7 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
        >
          Ir para o painel
        </Link>
      )}
    </main>
  );
}
