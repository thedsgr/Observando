import { cacheLife } from "next/cache";
import { REVALIDATE_SECONDS } from "@/lib/camara/client";
import { readYear, selectWindow, type BulkVoting } from "@/lib/camara/bulk-source";

/**
 * Casca de cache em volta de `bulk-source`.
 *
 * A leitura e a classificação moram lá, livres de Next, para o sincronizador
 * em `scripts/` poder reusá-las. Aqui fica só a política de cache.
 */

/** Quantas votações recentes o instantâneo guarda, em ordem cronológica. */
const RECENT_WINDOW = 40;
/** Quantas votações com voto individual o instantâneo guarda além dessas. */
const NOMINAL_WINDOW = 20;

export type BulkSnapshot = {
  votings: BulkVoting[];
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
  syncedAt: string;
};

/**
 * Monta o instantâneo a partir dos arquivos do ano corrente.
 *
 * Os arquivos somam dezenas de megabytes e são lidos uma vez por janela de
 * revalidação, mas o que fica guardado é só o recorte.
 */
export async function loadSnapshot(): Promise<BulkSnapshot> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  // O ano e o horário de sincronização são lidos aqui dentro de propósito:
  // ficam congelados no valor em cache, que é a semântica desejada, e o Next
  // recusa leituras de relógio fora de um escopo cacheado na pré-renderização.
  const year = new Date().getFullYear();
  const read = await readYear(year);

  return {
    votings: selectWindow(read.votings, {
      recent: RECENT_WINDOW,
      nominal: NOMINAL_WINDOW,
    }),
    coverageEnd: read.coverageEnd,
    yearTotal: read.yearTotal,
    yearWithVotes: read.yearWithVotes,
    syncedAt: new Date().toISOString(),
  };
}

export type { BulkVoting } from "@/lib/camara/bulk-source";
