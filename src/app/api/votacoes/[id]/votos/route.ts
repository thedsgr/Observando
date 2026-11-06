import { NextResponse } from "next/server";
import { fetchVotes } from "@/lib/camara";
import { CamaraApiError } from "@/lib/camara/client";

/**
 * Votos individuais de uma votação, sob demanda.
 *
 * Existe para que o feed não precise trazer centenas de registros por votação
 * antes de o usuário abrir os detalhes. A chamada à API oficial passa pelo
 * cache de dados do Next, então abrir a mesma votação de novo não gera tráfego
 * novo contra a Câmara.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const votes = await fetchVotes(id);
    return NextResponse.json({ votes });
  } catch (error) {
    const status = error instanceof CamaraApiError ? 502 : 500;
    return NextResponse.json(
      { error: "Não foi possível ler os votos na fonte oficial." },
      { status },
    );
  }
}
