import Link from "next/link";

export const metadata = { title: "Apagar meus dados — Observa" };

/** Destino do link de exclusão. Não apaga ao abrir — só mostra o botão. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; feito?: string; erro?: string; troca?: string }>;
}) {
  const { t, feito, erro, troca } = await searchParams;

  // `troca` só muda o texto: o link é o mesmo de exclusão, e o que ele apaga
  // também. Quem chega por aqui trocou de e-mail e quer parar os avisos no
  // endereço antigo, não "apagar os dados" do jeito que a frase sugere.
  const [title, body, action] = troca
    ? feito
      ? [
          "Este endereço não recebe mais avisos",
          "A inscrição dele foi apagada. Os avisos seguem pelo endereço novo, depois que ele for confirmado.",
          "",
        ]
      : erro || !t
        ? [
            "Não foi possível concluir",
            "O link pode ter expirado, já ter sido usado ou estar incompleto. Salve as preferências de novo para receber outro.",
            "",
          ]
        : [
            "Parar os avisos neste endereço?",
            "Você trocou o e-mail que recebe os avisos. Confirme para apagar a inscrição deste endereço antigo: o e-mail, as escolhas e o histórico de avisos. A inscrição no endereço novo não é afetada.",
            "Parar os avisos aqui",
          ]
    : feito
    ? [
        "Seus dados foram apagados",
        "Seu e-mail, suas escolhas e o histórico de avisos não existem mais no Observa. Se quiser voltar a acompanhar alguém, é só se inscrever de novo.",
      ]
    : erro || !t
      ? [
          "Não foi possível apagar",
          "O link pode ter expirado, já ter sido usado ou estar incompleto. Peça um novo na tela de preferências.",
          "",
        ]
      : [
          "Apagar seus dados?",
          "Serão apagados seu e-mail, os parlamentares e temas que você escolheu, a frequência e o histórico de avisos. Não tem volta.",
          "Apagar meus dados",
        ];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <p className="font-serif text-lg text-text">Observa</p>
      <h1 className="mt-5 font-serif text-3xl leading-tight text-text">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">{body}</p>
      {!feito && !erro && t ? (
        <form method="post" action="/api/apagar/confirmar" className="mt-7">
          <input type="hidden" name="t" value={t} />
          {troca && <input type="hidden" name="troca" value="1" />}
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
          >
            {action}
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
