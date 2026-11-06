import { cacheLife } from "next/cache";
import {
  REVALIDATE_SECONDS,
  camaraFetch,
  propositionSourceUrl,
  votingSourceUrl,
} from "@/lib/camara/client";
import { loadSnapshot, type BulkVoting } from "@/lib/camara/bulk";
import {
  deriveObjectKind,
  deriveObjectKindFromType,
} from "@/lib/camara/object-kind";
import { mapThemes } from "@/lib/camara/topic-map";
import type { RawDeputy, RawProposition, RawTheme, RawVote } from "@/lib/camara/raw";
import type {
  Deputy,
  Proposition,
  TopicAssignment,
  Vote,
  Voting,
  VotingWithContext,
} from "@/lib/types";


async function inBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    results.push(...(await Promise.all(batch.map(worker))));
  }
  return results;
}

function toDeputy(raw: RawDeputy): Deputy {
  return {
    id: raw.id,
    name: raw.nome,
    party: raw.siglaPartido ?? null,
    uf: raw.siglaUf ?? null,
    photoUrl: raw.urlFoto ?? null,
  };
}

/**
 * Votos individuais de uma votação, da API REST.
 *
 * Os arquivos anuais também os têm, mas lê-los inteiros (17 MB em 2026) para
 * atender uma votação sairia caro. Aqui o volume é pequeno e sob demanda.
 */
export async function fetchVotes(votingId: string): Promise<Vote[]> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  // O endpoint não aceita paginação: devolve a lista inteira.
  const raw = await camaraFetch<RawVote[]>(`/votacoes/${votingId}/votos`);
  return raw.map((vote) => ({
    votingId,
    deputy: toDeputy(vote.deputado_),
    // O arquivo de 2026 tem 466 votos com `voto` em branco. O registro existe,
    // mas sem valor: não é "sem registro" e não pode virar um valor inventado.
    value: vote.tipoVoto?.trim() ?? "",
    recordedAt: vote.dataRegistroVoto ?? null,
  }));
}

/**
 * Situação da tramitação e temas oficiais de uma proposição.
 *
 * Única parte que ainda depende da API REST, porque os arquivos anuais de
 * proposições cobrem um ano por arquivo e as proposições votadas hoje podem
 * ser de qualquer ano. Se a REST falhar, a votação continua exibível: o título
 * e o rótulo vêm do arquivo, e a interface declara a situação como não
 * informada e o tema como ausente.
 */
async function fetchPropositionExtras(id: number): Promise<{
  status: string | null;
  topics: TopicAssignment[];
}> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  const [raw, themes] = await Promise.all([
    camaraFetch<RawProposition>(`/proposicoes/${id}`).catch(() => null),
    camaraFetch<RawTheme[]>(`/proposicoes/${id}/temas`).catch(() => [] as RawTheme[]),
  ]);

  return {
    status: raw?.statusProposicao?.descricaoSituacao ?? null,
    topics: mapThemes(themes),
  };
}

/**
 * Tally em três baldes, como o arquivo entrega. `Outros` é um agregado da
 * fonte e não um valor de voto — ver a nota em `VotingWithContext`.
 */
function tallyOf(row: BulkVoting): Array<{ value: string; count: number }> {
  return [
    { value: "Sim", count: row.votosSim },
    { value: "Não", count: row.votosNao },
    { value: "Outros", count: row.votosOutros },
  ].filter((entry) => entry.count > 0);
}

function objectKindOf(row: BulkVoting) {
  // Um único objeto listado é uma determinação da fonte.
  if (row.objects.length === 1) {
    const fromType = deriveObjectKindFromType(row.objects[0].siglaTipo);
    if (fromType) return fromType;
  }
  // Vários candidatos, ou tipo desconhecido: resta a descrição em prosa.
  return deriveObjectKind(row.descricao);
}

/**
 * Feed público, montado a partir dos arquivos anuais de dados abertos.
 *
 * Os arquivos dizem quais votações têm voto individual sem exigir uma
 * requisição por votação, e trazem o tipo estruturado do objeto. Em troca,
 * fecham no dia anterior — `coverageEnd` é exibido para que ninguém suponha
 * que a página mostra o que aconteceu hoje.
 *
 * Esta função **não** é marcada com `"use cache"`: ela apenas compõe chamadas
 * que já são cacheadas por conta própria (`loadSnapshot` e
 * `fetchPropositionExtras`). Marcá-la também criaria fronteiras de cache
 * aninhadas, e o Next recusa aguardar, de dentro de uma função cacheada, uma
 * promessa criada por outra.
 */
export async function fetchRecentVotings(): Promise<{
  items: VotingWithContext[];
  syncedAt: string;
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
}> {
  const snapshot = await loadSnapshot();

  // Sem refatiar por data: o instantâneo já traz as votações recentes E as
  // nominais recentes, e cortar pelas mais recentes jogaria fora justamente as
  // nominais, que são raras e quase sempre mais antigas. Era isso que deixava
  // o painel de quem acompanha alguém vazio.
  const rows = snapshot.votings;

  const items = await inBatches(rows, 4, async (row) => {
    const first = row.propositions[0] ?? null;
    const extras = first
      ? await fetchPropositionExtras(first.id).catch(() => ({
          status: null,
          topics: [] as TopicAssignment[],
        }))
      : { status: null, topics: [] as TopicAssignment[] };

    const proposition: Proposition | null = first
      ? {
          id: first.id,
          label: first.label,
          title: first.ementa.replace(/^[“"]|[”"]$/g, "") || "Ementa não informada",
          status: extras.status,
          sourceUrl: propositionSourceUrl(first.id),
        }
      : null;

    const recordedVotes = row.votosSim + row.votosNao + row.votosOutros;

    const voting: Voting = {
      id: row.id,
      propositionId: first?.id ?? null,
      date: row.dateTime,
      objectDescription: row.descricao,
      objectKind: objectKindOf(row),
      objectCandidates: row.objects.length,
      hasIndividualVotes: recordedVotes > 0,
      result:
        row.aprovacao === 1 ? "Aprovado" : row.aprovacao === 0 ? "Rejeitado" : null,
      topics: extras.topics,
      sourceUrl: votingSourceUrl(row.id),
      syncedAt: snapshot.syncedAt,
    };

    return {
      voting,
      proposition,
      tally: tallyOf(row),
      recordedVotes,
    } satisfies VotingWithContext;
  });

  return {
    items,
    syncedAt: snapshot.syncedAt,
    coverageEnd: snapshot.coverageEnd,
    yearTotal: snapshot.yearTotal,
    yearWithVotes: snapshot.yearWithVotes,
  };
}

/** Lista de deputados em exercício, para a busca. */
export async function fetchDeputies(): Promise<Deputy[]> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS * 24, expire: REVALIDATE_SECONDS * 72 });

  const pages = [1, 2, 3, 4, 5, 6];
  const results = await inBatches(pages, 3, (pagina) =>
    camaraFetch<RawDeputy[]>("/deputados", {
      ordem: "ASC",
      ordenarPor: "nome",
      itens: 100,
      pagina,
    }).catch(() => [] as RawDeputy[]),
  );

  const byId = new Map<number, Deputy>();
  for (const raw of results.flat()) byId.set(raw.id, toDeputy(raw));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
