import type { Envelope } from "@/lib/camara/raw";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";

/**
 * Janela de revalidação, em segundos, aplicada via `cacheLife` nas funções
 * marcadas com `"use cache"`.
 *
 * A API devolve `retry-after: 30`, e `/votacoes/{id}/votos` não aceita
 * paginação — uma votação nominal vem inteira, com centenas de registros.
 * Consultar a fonte a cada requisição de página seria inviável, então tudo
 * passa pelo cache e a interface diz quando sincronizou (PRD §5.6, §8.3).
 */
export const REVALIDATE_SECONDS = 3600;

export class CamaraApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CamaraApiError";
  }
}

/**
 * Faz uma requisição à API oficial. Erros sobem como `CamaraApiError` para que
 * a interface possa declarar a falha em vez de exibir dados parciais como se
 * fossem completos (PRD §6.1 F14).
 */
export async function camaraFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new CamaraApiError(
      path,
      response.status,
      `A API da Câmara respondeu ${response.status} para ${path}`,
    );
  }

  const body = (await response.json()) as Envelope<T>;
  return body.dados;
}

/** Endereço do registro da votação na API oficial, para verificação. */
export function votingSourceUrl(votingId: string): string {
  return `${BASE}/votacoes/${votingId}`;
}

/** Ficha de tramitação da proposição no portal da Câmara. */
export function propositionSourceUrl(propositionId: number): string {
  return `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${propositionId}`;
}
