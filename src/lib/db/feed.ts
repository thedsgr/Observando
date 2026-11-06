import "server-only";
import { cacheLife } from "next/cache";
import { REVALIDATE_SECONDS } from "@/lib/camara/client";
import { PANEL_WINDOW } from "@/lib/camara/bulk-source";
import { publicDb } from "@/lib/db/client";
import type {
  ClassificationOrigin,
  Confidence,
  Deputy,
  Proposition,
  TopicAssignment,
  TopicId,
  Vote,
  VotingObjectKind,
  VotingWithContext,
} from "@/lib/types";

/**
 * Leitura do painel a partir do banco.
 *
 * O banco é preenchido pela sincronização (scripts/sync-votacoes.ts), que lê
 * os arquivos anuais da Câmara duas vezes por dia. Antes o painel lia esses
 * mesmos arquivos a cada revalidação — dezenas de megabytes para mostrar 60
 * votações — e pedia tema e situação à API REST, uma proposição por vez.
 * Agora é uma consulta, e o que a pessoa vê é exatamente o que gerou os
 * avisos dela: mesma classificação, mesmos temas, mesmos horários.
 *
 * Usa a chave publicável: tudo aqui tem leitura pública e nada aqui é dado
 * de assinante.
 */

type PropositionRow = {
  external_id: string;
  label: string;
  title: string;
  status: string | null;
  source_url: string;
};

type VotingRow = {
  external_id: string;
  occurred_at: string;
  object_description: string;
  object_kind: VotingObjectKind | null;
  object_confidence: Confidence | null;
  object_basis: string | null;
  object_candidates: number;
  result: string | null;
  votes_yes: number;
  votes_no: number;
  votes_other: number;
  source_url: string;
  propositions: PropositionRow | null;
  voting_topics: Array<{
    topic_id: TopicId;
    origin: ClassificationOrigin;
    confidence: Confidence;
    official_theme: string | null;
  }>;
};

const VOTING_COLUMNS = `
  external_id, occurred_at, object_description, object_kind,
  object_confidence, object_basis, object_candidates, result,
  votes_yes, votes_no, votes_other, source_url,
  propositions ( external_id, label, title, status, source_url ),
  voting_topics ( topic_id, origin, confidence, official_theme )
`;

function toItem(row: VotingRow, syncedAt: string): VotingWithContext {
  const proposition: Proposition | null = row.propositions
    ? {
        id: Number(row.propositions.external_id),
        label: row.propositions.label,
        title: row.propositions.title,
        status: row.propositions.status,
        sourceUrl: row.propositions.source_url,
      }
    : null;

  const topics: TopicAssignment[] = row.voting_topics.map((topic) => ({
    topicId: topic.topic_id,
    origin: topic.origin,
    confidence: topic.confidence,
    ...(topic.official_theme ? { officialTheme: topic.official_theme } : {}),
  }));

  const recordedVotes = row.votes_yes + row.votes_no + row.votes_other;

  return {
    voting: {
      id: row.external_id,
      propositionId: proposition?.id ?? null,
      date: row.occurred_at,
      objectDescription: row.object_description,
      objectKind:
        row.object_kind && row.object_confidence
          ? {
              kind: row.object_kind,
              confidence: row.object_confidence,
              basis: row.object_basis ?? "",
            }
          : null,
      objectCandidates: row.object_candidates,
      hasIndividualVotes: recordedVotes > 0,
      result:
        row.result === "Aprovado" || row.result === "Rejeitado" ? row.result : null,
      topics,
      sourceUrl: row.source_url,
      syncedAt,
    },
    proposition,
    // Três baldes, como o arquivo entrega. `Outros` é agregado da fonte, não
    // valor de voto — ver a nota em `VotingWithContext`.
    tally: [
      { value: "Sim", count: row.votes_yes },
      { value: "Não", count: row.votes_no },
      { value: "Outros", count: row.votes_other },
    ].filter((entry) => entry.count > 0),
    recordedVotes,
  };
}

/**
 * Votações do painel: as mais recentes e, além delas, as mais recentes com
 * voto individual. Só o primeiro recorte deixaria vazio o painel de quem
 * acompanha alguém, porque as nominais são raras e quase sempre mais antigas.
 */
export async function fetchRecentVotings(): Promise<{
  items: VotingWithContext[];
  syncedAt: string;
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
}> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  const db = publicDb();
  const base = () =>
    db
      .from("votings")
      .select(VOTING_COLUMNS)
      .eq("house_id", "camara")
      .order("occurred_at", { ascending: false })
      .order("external_id", { ascending: false });

  const [recent, nominal, state] = await Promise.all([
    base().limit(PANEL_WINDOW.recent),
    base().eq("has_individual_votes", true).limit(PANEL_WINDOW.nominal),
    db.rpc("estado_do_painel").maybeSingle(),
  ]);
  for (const result of [recent, nominal, state]) {
    if (result.error) throw new Error(`Falha ao ler o painel: ${result.error.message}`);
  }

  const panel = state.data as {
    synced_at: string;
    coverage_end: string;
    year_total: number;
    year_with_votes: number;
  } | null;
  const syncedAt = panel?.synced_at ?? "";

  const byId = new Map<string, VotingRow>();
  for (const row of [
    ...((recent.data ?? []) as unknown as VotingRow[]),
    ...((nominal.data ?? []) as unknown as VotingRow[]),
  ]) {
    byId.set(row.external_id, row);
  }
  const items = [...byId.values()]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((row) => toItem(row, syncedAt));

  return {
    items,
    syncedAt,
    coverageEnd: panel?.coverage_end ?? "",
    yearTotal: panel?.year_total ?? 0,
    yearWithVotes: panel?.year_with_votes ?? 0,
  };
}

type LegislatorRow = {
  external_id: string;
  name: string;
  party: string | null;
  uf: string | null;
  photo_url: string | null;
};

function toDeputy(row: LegislatorRow): Deputy {
  return {
    id: Number(row.external_id),
    name: row.name,
    party: row.party,
    uf: row.uf,
    photoUrl: row.photo_url,
  };
}

/** Deputados em exercício, para a busca. */
export async function fetchDeputies(): Promise<Deputy[]> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS * 24, expire: REVALIDATE_SECONDS * 72 });

  const { data, error } = await publicDb()
    .from("legislators")
    .select("external_id, name, party, uf, photo_url")
    .eq("house_id", "camara")
    .eq("in_office", true)
    .order("name");
  if (error) throw new Error(`Falha ao ler os deputados: ${error.message}`);
  return ((data ?? []) as LegislatorRow[])
    .map(toDeputy)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

type VoteRow = {
  value: string;
  recorded_at: string | null;
  legislators: LegislatorRow;
  votings: { external_id: string };
};

/**
 * Votos individuais de votações, com o parlamentar de cada um.
 *
 * Devolve uma entrada para cada votação pedida que existe no banco, mesmo sem
 * voto — votação ausente do resultado é votação desconhecida, não "sem
 * registro". Quem chama precisa dessa distinção (PRD §8.1).
 *
 * `deputyIds`, quando dado, restringe aos parlamentares pedidos.
 */
export async function fetchVotes(
  votingIds: string[],
  deputyIds?: number[],
): Promise<Record<string, Vote[]>> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE_SECONDS, expire: REVALIDATE_SECONDS * 24 });

  const db = publicDb();
  const { data: known, error: knownError } = await db
    .from("votings")
    .select("external_id")
    .eq("house_id", "camara")
    .in("external_id", votingIds);
  if (knownError) throw new Error(`Falha ao ler votações: ${knownError.message}`);

  const byVoting: Record<string, Vote[]> = {};
  for (const row of known ?? []) byVoting[row.external_id as string] = [];
  const found = Object.keys(byVoting);
  if (found.length === 0) return byVoting;

  const page = (from: number, to: number) => {
    let query = db
      .from("votes")
      .select(
        "value, recorded_at, legislators!inner ( external_id, name, party, uf, photo_url ), votings!inner ( external_id )",
      )
      .eq("votings.house_id", "camara")
      .in("votings.external_id", found);
    if (deputyIds) query = query.in("legislators.external_id", deputyIds.map(String));
    return query.order("voting_id").order("legislator_id").range(from, to);
  };

  // Uma votação nominal tem até 513 votos e o PostgREST corta em 1000 linhas
  // por resposta: sem paginar, a segunda votação de um lote sairia pela
  // metade, e metade dos parlamentares apareceria "sem registro".
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao ler votos: ${error.message}`);
    const rows = (data ?? []) as unknown as VoteRow[];
    for (const row of rows) {
      byVoting[row.votings.external_id]?.push({
        votingId: row.votings.external_id,
        deputy: toDeputy(row.legislators),
        value: row.value,
        recordedAt: row.recorded_at,
      });
    }
    if (rows.length < PAGE) break;
  }

  return byVoting;
}
