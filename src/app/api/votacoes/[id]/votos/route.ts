import { NextResponse } from "next/server";
import { fetchVotes } from "@/lib/db/feed";

/**
 * Votos individuais de uma votação, sob demanda.
 *
 * Existe para que o feed não precise trazer centenas de registros por votação
 * antes de o usuário abrir os detalhes. Lê do banco, já com o parlamentar de
 * cada voto, e passa pelo cache de dados do Next.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const byVoting = await fetchVotes([id]);
    const votes = byVoting[id];
    if (!votes) {
      return NextResponse.json({ error: "Votação desconhecida." }, { status: 404 });
    }
    return NextResponse.json({ votes });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler os votos." },
      { status: 500 },
    );
  }
}
