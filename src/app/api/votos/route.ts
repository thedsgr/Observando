import { NextResponse } from "next/server";
import { fetchVotes } from "@/lib/camara";

/**
 * Votos de um conjunto de parlamentares num conjunto de votações.
 *
 * Existe porque a fonte não permite consultar votações por parlamentar: o
 * cruzamento é feito aqui, no servidor, sobre os votos já em cache. Com isso o
 * painel personalizado faz uma requisição, não uma por votação.
 *
 * O formato distingue dois casos que não podem ser confundidos: uma votação
 * ausente do mapa não foi consultada; uma votação presente sem a chave do
 * parlamentar significa que **não há registro** dele — o que não é ausência
 * nem voto contrário (PRD §8.1).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const deputyIds = (params.get("deputados") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 10);

  const votingIds = (params.get("votacoes") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 60);

  if (deputyIds.length === 0 || votingIds.length === 0) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const wanted = new Set(deputyIds);

  /**
   * Em lotes pequenos, e não tudo de uma vez: a fonte limita taxa e responde
   * `retry-after: 30`. Disparar dezenas de requisições simultâneas fazia a
   * maioria falhar, e o cruzamento voltava quase vazio — o que a interface
   * mostraria como "sem registro", exatamente o erro que o PRD §8.1 proíbe.
   */
  const entries: Array<readonly [string, Record<string, string>]> = [];
  for (let index = 0; index < votingIds.length; index += 4) {
    const batch = votingIds.slice(index, index + 4);
    entries.push(
      ...(await Promise.all(
        batch.map(async (votingId) => {
          const votes = await fetchVotes(votingId).catch(() => []);
          const own: Record<string, string> = {};
          for (const vote of votes) {
            if (wanted.has(vote.deputy.id)) own[String(vote.deputy.id)] = vote.value;
          }
          return [votingId, own] as const;
        }),
      )),
    );
  }

  return NextResponse.json({ votes: Object.fromEntries(entries) });
}
