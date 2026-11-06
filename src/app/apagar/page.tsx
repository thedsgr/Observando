import Link from "next/link";

export const metadata = { title: "Apagar meus dados — Observa" };

/** Destino do link de exclusão. Não apaga ao abrir — só mostra o botão. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; feito?: string; erro?: string }>;
}) {
  const { t, feito, erro } = await searchParams;

  const [title, body] = feito
    ? [
        "Seus dados foram apagados",
        "Seu e-mail, suas escolhas e o histórico de avisos não existem mais no Observa. Se quiser voltar a acompanhar alguém, é só se inscrever de novo.",
      ]
    : erro || !t
      ? [
          "Não foi possível apagar",
          "O link pode ter expirado, já ter sido usado ou estar incompleto. Peça um novo na tela de preferências.",
        ]
      : [
          "Apagar seus dados?",
          "Serão apagados seu e-mail, os parlamentares e temas que você escolheu, a frequência e o histórico de avisos. Não tem volta.",
        ];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <p className="font-serif text-lg text-text">Observa</p>
      <h1 className="mt-5 font-serif text-3xl leading-tight text-text">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">{body}</p>
      {!feito && !erro && t ? (
        <form method="post" action="/api/apagar/confirmar" className="mt-7">
          <input type="hidden" name="t" value={t} />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
          >
            Apagar meus dados
          </button>
        </form>
      ) : (
        <Link
          href="/"
          className="mt-7 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
        >
          Ir para o início
        </Link>
      )}
    </main>
  );
}
