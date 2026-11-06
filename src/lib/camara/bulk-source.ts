import {
  deriveObjectKind,
  deriveObjectKindFromType,
} from "@/lib/camara/object-kind";
import type { ObjectKindAssignment } from "@/lib/types";

/* =========================================================================
   Leitura dos arquivos anuais de dados abertos da Câmara.

   Este módulo é deliberadamente livre de Next: nada de `"use cache"`, nada de
   `next/cache`. O cache mora em `bulk.ts`, que é uma casca fina em volta
   daqui. A separação existe para o sincronizador em `scripts/` poder reusar
   exatamente esta leitura e esta classificação — se o script reimplementasse
   qualquer uma das duas, haveria duas respostas possíveis para "que tipo de
   objeto foi votado", e a do banco divergiria da que a pessoa vê na tela.

   Por que estes arquivos e não só a API REST: `votacoes-{ano}.csv` traz
   `votosSim`, `votosNao` e `votosOutros`, colunas que a API REST **não**
   expõe. Conferido contra `votacoesVotos-2026.csv`: as 159 votações de 2026
   com contagem > 0 são exatamente as 159 com voto individual, as somas batem
   em todos os casos, e não há voto individual de votação fora dessa lista.
   Isso diz quais votações têm voto individual sem uma requisição por votação.

   O custo é defasagem: os arquivos fecham no dia anterior, enquanto a API
   REST mostra o dia corrente. A interface declara a data de corte em vez de
   fingir que está atualizada (PRD §5.6, §8.3).
   ========================================================================= */

export const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";

/**
 * CSV da Câmara: separador `;`, aspas duplas escapadas por duplicação e BOM
 * no início do arquivo. Campos podem conter quebra de linha dentro de aspas —
 * por isso um parser de verdade, e não split por linha: em 2026 isso é a
 * diferença entre 7.978 votações e 9.804 linhas.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
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

export async function fetchCsv(
  path: string,
): Promise<Array<Record<string, string>>> {
  const response = await fetch(`${BULK_BASE}/${path}`, {
    headers: { accept: "text/csv" },
  });
  if (!response.ok) {
    throw new Error(`Arquivo ${path} respondeu ${response.status}`);
  }
  return parseCsv(await response.text());
}

const SOURCE_TIME_ZONE = "America/Sao_Paulo";

/**
 * Converte o horário da fonte, que vem SEM fuso, num instante inequívoco.
 *
 * Os arquivos da Câmara trazem `2026-11-04T18:05:42` em horário de Brasília,
 * sem dizer isso. Deixado assim, `new Date()` interpreta no fuso de quem roda
 * o código: numa máquina em Brasília acerta por coincidência, num servidor em
 * UTC — o padrão em produção — todo horário sai três horas adiantado, e o
 * Postgres grava o instante errado. Conferido pela distribuição das votações
 * nominais de 2026: lidas como Brasília vão das 10h às 23h, a agenda real da
 * Câmara; lidas como UTC o plenário começaria às 7h e nunca passaria das 20h.
 *
 * O deslocamento vem do fuso nomeado, não de um `-03:00` fixo: o Brasil teve
 * horário de verão até 2019, e o sincronizador aceita anos anteriores.
 */
export function sourceTimeToIso(value: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value ?? "");
  if (!match) return null;
  // Já tem fuso explícito: não há o que adivinhar.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value ?? "")) return new Date(value!).toISOString();

  const [, y, mo, d, h, mi, se] = match.map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, se || 0);

  // Deslocamento do fuso num instante: diferença entre o relógio de parede lá
  // e o UTC. Calculado duas vezes porque, perto de uma troca de horário de
  // verão, o deslocamento do palpite pode não ser o do instante final.
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: SOURCE_TIME_ZONE,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(instant))
        .map((part) => [part.type, Number(part.value)]),
    );
    const wall = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    return wall - instant;
  };

  let instant = wallAsUtc - offsetAt(wallAsUtc);
  instant = wallAsUtc - offsetAt(instant);
  return new Date(instant).toISOString();
}

export function toInt(value: string | undefined): number {
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
  /**
   * Quando aconteceu, em ISO com fuso — ver `occurrenceOf`. Vazio só se a
   * fonte não trouxer data nenhuma.
   */
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

export type BulkYear = {
  /** Todas as votações do ano, da mais recente para a mais antiga. */
  votings: BulkVoting[];
  /** Instante do registro mais recente presente nos arquivos (ISO, UTC). */
  coverageEnd: string;
  yearTotal: number;
  /** Quantas têm voto individual. */
  yearWithVotes: number;
};

export function hasIndividualVotes(row: BulkVoting): boolean {
  return row.votosSim + row.votosNao + row.votosOutros > 0;
}

/** Resultado da DELIBERAÇÃO. Não é o voto de ninguém (PRD §8.1). */
export function resultOf(
  aprovacao: number | null,
): "Aprovado" | "Rejeitado" | null {
  if (aprovacao === 1) return "Aprovado";
  if (aprovacao === 0) return "Rejeitado";
  return null;
}

/**
 * Tipo do objeto votado, por dois caminhos e nessa ordem.
 *
 * Fica aqui, e não na interface nem no script, porque é a mesma pergunta nos
 * dois lugares e uma resposta só.
 */
export function objectKindOf(row: BulkVoting): ObjectKindAssignment | null {
  // Um único objeto listado é uma determinação da fonte.
  if (row.objects.length === 1) {
    const fromType = deriveObjectKindFromType(row.objects[0].siglaTipo);
    if (fromType) return fromType;
  }
  // Vários candidatos, ou tipo desconhecido: resta a descrição em prosa.
  return deriveObjectKind(row.descricao);
}

/**
 * Quando a votação aconteceu, a partir das três datas que a fonte oferece.
 *
 * Nenhuma delas sozinha serve:
 * - `data` é o dia oficial, sempre certo, mas sem hora;
 * - `dataHoraRegistro` é quando o registro foi lançado — em 28 votações de
 *   2026 cai em outro dia, num caso cinco dias depois dos votos;
 * - `ultimaAberturaVotacao_dataHoraRegistro` é a última abertura, preenchida
 *   em 812 de 7.978 e às vezes dias depois, quando a votação é reaberta.
 *
 * Então: a hora com data, desde que caia no dia oficial. Validado contra o
 * horário real do primeiro voto nas 159 nominais de 2026: todas no dia certo,
 * 158 dentro de duas horas. Quando nenhuma hora cai no dia oficial (25 de
 * 7.978, uma nominal), fica o registro: é dado real da fonte, e qualquer hora
 * escolhida por nós seria inventada.
 */
function occurrenceOf(row: Record<string, string>): string {
  const day = row.data ?? "";
  const registro = row.dataHoraRegistro ?? "";
  const abertura = row.ultimaAberturaVotacao_dataHoraRegistro ?? "";
  if (registro && registro.slice(0, 10) === day) return registro;
  if (abertura && abertura.slice(0, 10) === day) return abertura;
  return registro;
}

/** Lê os três arquivos do ano e devolve todas as votações, já compostas. */
export async function readYear(year: number): Promise<BulkYear> {
  const [votacoes, objetos, proposicoes] = await Promise.all([
    fetchCsv(`votacoes/csv/votacoes-${year}.csv`),
    fetchCsv(`votacoesObjetos/csv/votacoesObjetos-${year}.csv`),
    fetchCsv(`votacoesProposicoes/csv/votacoesProposicoes-${year}.csv`),
  ]);

  const objectsByVoting = new Map<string, BulkObject[]>();
  for (const row of objetos) {
    const list = objectsByVoting.get(row.idVotacao) ?? [];
    list.push({
      siglaTipo: row.proposicao_siglaTipo ?? "",
      titulo: row.proposicao_titulo ?? "",
    });
    objectsByVoting.set(row.idVotacao, list);
  }

  const propositionsByVoting = new Map<string, BulkProposition[]>();
  for (const row of proposicoes) {
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

  const votings: BulkVoting[] = votacoes
    .map((row) => ({
      id: row.id,
      dateTime: sourceTimeToIso(occurrenceOf(row)) ?? "",
      descricao: row.descricao ?? "",
      aprovacao: row.aprovacao === "" ? null : toInt(row.aprovacao),
      votosSim: toInt(row.votosSim),
      votosNao: toInt(row.votosNao),
      votosOutros: toInt(row.votosOutros),
      objects: objectsByVoting.get(row.id) ?? [],
      propositions: propositionsByVoting.get(row.id) ?? [],
    }))
    .sort((a, b) => (b.dateTime ?? "").localeCompare(a.dateTime ?? ""));

  return {
    votings,
    coverageEnd: votings[0]?.dateTime ?? "",
    yearTotal: votings.length,
    yearWithVotes: votings.filter(hasIndividualVotes).length,
  };
}

/**
 * Recorte do feed: as mais recentes E as nominais mais recentes.
 *
 * As duas listas, não uma: nominais são 2% do total e quase sempre mais
 * antigas que as últimas quarenta, então cortar só por data as eliminaria —
 * era isso que deixava vazio o painel de quem acompanha alguém.
 */
export function selectWindow(
  votings: BulkVoting[],
  options: { recent: number; nominal: number },
): BulkVoting[] {
  const selected = new Map<string, BulkVoting>();
  for (const row of votings.slice(0, options.recent)) selected.set(row.id, row);
  for (const row of votings.filter(hasIndividualVotes).slice(0, options.nominal)) {
    selected.set(row.id, row);
  }
  return [...selected.values()].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}
