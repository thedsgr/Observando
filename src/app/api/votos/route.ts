import { NextResponse } from "next/server";
import { fetchVotes } from "@/lib/db/feed";

/**
 * Votos de um conjunto de parlamentares num conjunto de votações.
 *
 * O cruzamento é feito no servidor, numa consulta só, para o painel
 * personalizado fazer uma requisição em vez de uma por votação.
 *
 * O formato distingue dois casos que não podem ser confundidos: uma votação
 * ausente do mapa não é conhecida; uma votação presente sem a chave do
 * parlamentar significa que **não há registro** dele — o que não é ausência
 * nem voto contrário (PRD §8.1). Por isso uma falha de leitura responde erro,
 * em vez de um mapa vazio que a interface leria como "sem registro" de todos.
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

  try {
    const byVoting = await fetchVotes(votingIds, deputyIds);
    const votes: Record<string, Record<string, string>> = {};
    for (const [votingId, list] of Object.entries(byVoting)) {
      votes[votingId] = Object.fromEntries(
        list.map((vote) => [String(vote.deputy.id), vote.value]),
      );
    }
    return NextResponse.json({ votes });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler os votos." },
      { status: 500 },
    );
  }
}
