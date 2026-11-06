import { cacheLife } from "next/cache";
import { REVALIDATE_SECONDS } from "@/lib/camara/client";

/* =========================================================================
   Leitura dos arquivos anuais de dados abertos da Câmara.

   Por que estes arquivos e não só a API REST: `votacoes-{ano}.csv` traz
   `votosSim`, `votosNao` e `votosOutros`, colunas que a API REST **não**
   expõe. Conferido contra `votacoesVotos-2026.csv`: as 159 votações de 2026
   com contagem > 0 são exatamente as 159 com voto individual, e as somas
   batem em todos os casos. Isso diz quais votações têm voto individual sem
   uma requisição de ~150 KB por votação.

   O custo é defasagem: os arquivos fecham no dia anterior, enquanto a API
   REST mostra o dia corrente. A interface declara a data de corte em vez de
   fingir que está atualizada (PRD §5.6, §8.3).
   ========================================================================= */

const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";

/** Quantas votações recentes o instantâneo guarda, em ordem cronológica. */
const RECENT_WINDOW = 40;
/** Quantas votações com voto individual o instantâneo guarda além dessas. */
const NOMINAL_WINDOW = 20;

/**
 * CSV da Câmara: separador `;`, aspas duplas escapadas por duplicação e BOM
 * no início do arquivo.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];

    if (quoted) {
      if (char === '"') {
        if (body[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [header, ...data] = rows;
  if (!header) return [];
  return data
    .filter((line) => line.length === header.length)
    .map((line) =>
      Object.fromEntries(header.map((key, index) => [key.trim(), line[index]])),
    );
}

async function fetchCsv(path: string): Promise<Array<Record<string, string>>> {
  const response = await fetch(`${BULK_BASE}/${path}`, {
    headers: { accept: "text/csv" },
  });
  if (!response.ok) {
    throw new Error(`Arquivo ${path} respondeu ${response.status}`);
  }
  return parseCsv(await response.text());
}

function toInt(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Objeto candidato de uma votação, como consta em `votacoesObjetos`. */
export type BulkObject = {
  siglaTipo: string;
  titulo: string;
};

/** Proposição afetada por uma votação, como consta em `votacoesProposicoes`. */
export type BulkProposition = {
  id: number;
  label: string;
  ementa: string;
};

export type BulkVoting = {
  id: string;
  dateTime: string;
  descricao: string;
  aprovacao: number | null;
  /** Contagens oficiais; a soma > 0 significa que há voto individual. */
  votosSim: number;
  votosNao: number;
  votosOutros: number;
  objects: BulkObject[];
  propositions: BulkProposition[];
};

export type BulkSnapshot = {
  votings: BulkVoting[];
  /** Data do registro mais recente presente nos arquivos. */
  coverageEnd: string;
  /** Total de votações do ano no arquivo, para a transparência de cobertura. */
  yearTotal: number;
  /** Quantas delas têm voto individual. */
  yearWithVotes: number;
  syncedAt: string;
};

/**
 * Monta o instantâneo a partir dos três arquivos do ano corrente.
 *
 * Só as votações recentes e as nominais recentes entram no valor em cache: os
 * arquivos somam dezenas de megabytes e são lidos uma vez por janela de
 * revalidação, mas o que fica guardado é pequeno.
 */
export async function loadSnapshot(): Promise<BulkSnapshot> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  // O ano e o horário de sincronização são lidos aqui dentro de propósito:
  // ficam congelados no valor em cache, que é a semântica desejada, e o Next
  // recusa leituras de relógio fora de um escopo cacheado na pré-renderização.
  const year = new Date().getFullYear();

  const [votacoes, objetos, proposicoes] = await Promise.all([
    fetchCsv(`votacoes/csv/votacoes-${year}.csv`),
    fetchCsv(`votacoesObjetos/csv/votacoesObjetos-${year}.csv`),
    fetchCsv(`votacoesProposicoes/csv/votacoesProposicoes-${year}.csv`),
  ]);

  const byDateDesc = [...votacoes].sort((a, b) =>
    (b.dataHoraRegistro ?? "").localeCompare(a.dataHoraRegistro ?? ""),
  );

  const hasVotes = (row: Record<string, string>) =>
    toInt(row.votosSim) + toInt(row.votosNao) + toInt(row.votosOutros) > 0;

  const selected = new Map<string, Record<string, string>>();
  for (const row of byDateDesc.slice(0, RECENT_WINDOW)) selected.set(row.id, row);
  for (const row of byDateDesc.filter(hasVotes).slice(0, NOMINAL_WINDOW)) {
    selected.set(row.id, row);
  }

  const objectsByVoting = new Map<string, BulkObject[]>();
  for (const row of objetos) {
    if (!selected.has(row.idVotacao)) continue;
    const list = objectsByVoting.get(row.idVotacao) ?? [];
    list.push({
      siglaTipo: row.proposicao_siglaTipo ?? "",
      titulo: row.proposicao_titulo ?? "",
    });
    objectsByVoting.set(row.idVotacao, list);
  }

  const propositionsByVoting = new Map<string, BulkProposition[]>();
  for (const row of proposicoes) {
    if (!selected.has(row.idVotacao)) continue;
    const id = toInt(row.proposicao_id);
    if (!id) continue;
    const list = propositionsByVoting.get(row.idVotacao) ?? [];
    if (list.some((item) => item.id === id)) continue;
    list.push({
      id,
      label:
        row.proposicao_titulo?.trim() ||
        `${row.proposicao_siglaTipo} ${row.proposicao_numero}/${row.proposicao_ano}`,
      ementa: row.proposicao_ementa?.trim() ?? "",
    });
    propositionsByVoting.set(row.idVotacao, list);
  }

  const votings: BulkVoting[] = [...selected.values()]
    .map((row) => ({
      id: row.id,
      dateTime: row.dataHoraRegistro,
      descricao: row.descricao ?? "",
      aprovacao: row.aprovacao === "" ? null : toInt(row.aprovacao),
      votosSim: toInt(row.votosSim),
      votosNao: toInt(row.votosNao),
      votosOutros: toInt(row.votosOutros),
      objects: objectsByVoting.get(row.id) ?? [],
      propositions: propositionsByVoting.get(row.id) ?? [],
    }))
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

  return {
    votings,
    coverageEnd: byDateDesc[0]?.dataHoraRegistro ?? "",
    yearTotal: votacoes.length,
    yearWithVotes: votacoes.filter(hasVotes).length,
    syncedAt: new Date().toISOString(),
  };
}
