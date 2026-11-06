import { TOPICS } from "@/lib/topics";
import type {
  Deputy,
  Topic,
  TopicId,
  VoteLookup,
  VotingWithContext,
} from "@/lib/types";

/** Funções puras sobre os dados já carregados. Seguras no cliente. */

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function searchDeputies(deputies: Deputy[], query: string): Deputy[] {
  const needle = normalize(query);
  if (!needle) return deputies;
  return deputies.filter((deputy) =>
    normalize([deputy.name, deputy.party ?? "", deputy.uf ?? ""].join(" ")).includes(
      needle,
    ),
  );
}

/**
 * Votos cruzados: por votação, o valor de cada parlamentar consultado.
 *
 * Uma votação ausente do mapa não foi consultada. Uma votação presente sem a
 * chave de um parlamentar significa que **não há registro** dele, que não é
 * ausência nem voto contrário (PRD §8.1).
 */
export type DeputyVotes = Record<string, Record<string, string>>;

export type VotingFilters = {
  /** Tema único escolhido na interface. */
  topicId?: TopicId | null;
  /** Temas do acompanhamento. Vazio ou ausente significa todos. */
  topicIds?: TopicId[];
  /** Só votações em que ao menos um destes parlamentares tem registro. */
  deputyIds?: number[] | null;
  deputyVotes?: DeputyVotes | null;
  /** Só votações com voto individual publicado. */
  onlyWithVotes?: boolean;
};

function matchesTopics(
  voting: VotingWithContext["voting"],
  topicIds: TopicId[] | undefined,
): boolean {
  if (!topicIds || topicIds.length === 0) return true;

  // Votação sem nenhum tema atribuído NÃO é escondida por um filtro de tema.
  // Esconder seria deixar de mostrar um voto real do parlamentar por falha da
  // nossa classificação — e o usuário concluiria que ele não votou. Entre
  // mostrar algo fora do tema e omitir um voto que existe, o PRD §8.2 (os
  // temas priorizam, não ocultam histórico) manda mostrar.
  if (voting.topics.length === 0) return true;

  return voting.topics.some((topic) => topicIds.includes(topic.topicId));
}

export function filterVotings(
  items: VotingWithContext[],
  filters: VotingFilters,
): VotingWithContext[] {
  const { topicId, topicIds, deputyIds, deputyVotes, onlyWithVotes } = filters;

  return items.filter((item) => {
    const { voting } = item;

    if (topicId && !voting.topics.some((topic) => topic.topicId === topicId)) {
      return false;
    }
    if (!matchesTopics(voting, topicIds)) return false;
    if (onlyWithVotes && !voting.hasIndividualVotes) return false;

    if (deputyIds && deputyIds.length > 0) {
      // Só dá para afirmar algo depois que o cruzamento chegou.
      if (!deputyVotes) return false;
      const forVoting = deputyVotes[voting.id];
      if (!forVoting) return false;
      // `!== undefined` e não truthiness: um voto com valor em branco é um
      // registro que existe (a fonte tem 466 deles em 2026), e tratá-lo como
      // ausência seria exatamente o erro que o PRD §8.1 proíbe.
      if (!deputyIds.some((id) => forVoting[String(id)] !== undefined)) return false;
    }

    return true;
  });
}

/**
 * Voto de um parlamentar numa votação, distinguindo os três casos que o
 * PRD §8.1 proíbe confundir.
 */
export function lookupVote(
  item: VotingWithContext,
  deputyVotes: DeputyVotes | null,
  deputyId: number,
): VoteLookup {
  if (!item.voting.hasIndividualVotes) return { kind: "sem-votos-individuais" };
  const value = deputyVotes?.[item.voting.id]?.[String(deputyId)];
  // Idem: string vazia é registro sem valor, não ausência de registro.
  return value !== undefined
    ? { kind: "registrado", value }
    : { kind: "sem-registro" };
}

/**
 * Cobertura do que foi lido da fonte. Mede o estado do dado, não o desempenho
 * de parlamentares — rankings estão fora do MVP (PRD §6.2).
 */
export function coverageOf(items: VotingWithContext[]) {
  const total = items.length;
  const withVotes = items.filter((item) => item.voting.hasIndividualVotes).length;
  const undeterminedObject = items.filter((item) => !item.voting.objectKind).length;
  const lowConfidenceObject = items.filter(
    (item) => item.voting.objectKind?.confidence === "media",
  ).length;
  const withoutTopic = items.filter((item) => item.voting.topics.length === 0).length;
  const uncertainTopic = items.filter((item) =>
    item.voting.topics.some((topic) => topic.confidence !== "alta"),
  ).length;
  const withoutProposition = items.filter((item) => !item.proposition).length;
  const dates = items.map((item) => item.voting.date).sort();

  return {
    total,
    withVotes,
    withoutVotes: total - withVotes,
    recordedVotes: items.reduce((sum, item) => sum + item.recordedVotes, 0),
    undeterminedObject,
    lowConfidenceObject,
    withoutTopic,
    uncertainTopic,
    withoutProposition,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
  };
}

export function topicCounts(items: VotingWithContext[]): Array<{
  topic: Topic;
  count: number;
  uncertain: number;
}> {
  return TOPICS.map((topic) => {
    const matching = items.filter((item) =>
      item.voting.topics.some((assignment) => assignment.topicId === topic.id),
    );
    return {
      topic,
      count: matching.length,
      uncertain: matching.filter((item) =>
        item.voting.topics.some(
          (assignment) =>
            assignment.topicId === topic.id && assignment.confidence !== "alta",
        ),
      ).length,
    };
  }).sort(
    (a, b) => b.count - a.count || a.topic.label.localeCompare(b.topic.label, "pt-BR"),
  );
}
