/* =========================================================================
   Modelo de domínio do Observa.

   Os tipos existem para tornar difícil violar as regras do PRD §8.1, e foram
   revistos na Fase 2 contra o que a API da Câmara realmente entrega:

   - a API NÃO informa se uma votação foi nominal. `/votacoes/{id}/votos` ou
     traz votos individuais, ou vem vazio — e vazio não distingue "votação
     simbólica" de "votos ainda não publicados". Por isso o campo é
     `hasIndividualVotes` (fato observável), não `isNominal` (interpretação).
   - a API NÃO tem campo estruturado para o tipo do objeto votado. Ele é
     derivado da descrição oficial em prosa e vem sempre com grau de confiança,
     podendo ser `null` quando nenhuma regra se aplica.
   - `descricao` da votação é a única descrição oficial do objeto e é
     preservada literalmente.
   ========================================================================= */

export type TopicId =
  | "saude"
  | "educacao"
  | "economia"
  | "meio-ambiente"
  | "seguranca-publica"
  | "direitos-sociais"
  | "transporte"
  | "tecnologia";

export type Topic = {
  id: TopicId;
  label: string;
};

/**
 * Tipo do objeto submetido a voto. Ampliado na Fase 2 para cobrir o que
 * aparece de fato nas descrições oficiais (parecer, recurso, redação final).
 */
export type VotingObjectKind =
  | "texto-principal"
  | "substitutivo"
  | "redacao-final"
  | "emenda"
  | "destaque"
  | "requerimento"
  | "parecer"
  | "recurso"
  | "procedimental";

export type Confidence = "alta" | "media" | "baixa";

/** Origem da classificação, para poder auditar e sinalizar incerteza. */
export type ClassificationOrigin = "metadado-oficial" | "regra" | "ia";

export type TopicAssignment = {
  topicId: TopicId;
  origin: ClassificationOrigin;
  confidence: Confidence;
  /** Tema oficial da Câmara que originou a atribuição, quando houver. */
  officialTheme?: string;
};

/** Tipo do objeto votado, sempre acompanhado de como foi determinado. */
export type ObjectKindAssignment = {
  kind: VotingObjectKind;
  confidence: Confidence;
  /** Trecho da descrição oficial que disparou a regra, para auditoria. */
  basis: string;
};

export type Deputy = {
  /** Identificador oficial da Câmara. Chave preservada, nunca reatribuída. */
  id: number;
  name: string;
  /** Pode faltar na fonte; o produto não preenche a lacuna. */
  party: string | null;
  uf: string | null;
  photoUrl: string | null;
};

export type Proposition = {
  /** Identificador oficial da Câmara. */
  id: number;
  /** Rótulo curto, ex.: "PL 4674/2024". */
  label: string;
  /** Ementa oficial. É o título que o produto exibe. */
  title: string;
  /**
   * Situação da tramitação (`statusProposicao.descricaoSituacao`) — distinta
   * do resultado de qualquer votação isolada (PRD §8.1).
   */
  status: string | null;
  /** Ficha de tramitação no portal da Câmara. */
  sourceUrl: string;
};

export type Voting = {
  /** Identificador oficial da votação, ex.: "2483447-25". */
  id: string;
  /** Proposição afetada, quando a fonte permite identificá-la. */
  propositionId: number | null;
  /** Data/hora do registro, em ISO 8601. */
  date: string;
  /**
   * Descrição oficial do que foi votado, preservada literalmente. É a única
   * descrição do objeto que a fonte fornece.
   */
  objectDescription: string;
  /** Tipo do objeto; `null` quando nem o arquivo nem a descrição determinam. */
  objectKind: ObjectKindAssignment | null;
  /**
   * Quantos objetos a fonte lista como candidatos a esta votação. Mais de um
   * significa que o arquivo não determina qual foi submetido a voto.
   */
  objectCandidates: number;
  /**
   * Houve votos individuais publicados pela fonte. Quando `false`, o produto
   * não atribui voto a ninguém e não afirma que a votação foi simbólica.
   */
  hasIndividualVotes: boolean;
  /** Resultado da deliberação, de `aprovacao`. Não é o voto de ninguém. */
  result: "Aprovado" | "Rejeitado" | null;
  topics: TopicAssignment[];
  /** Recurso oficial correspondente a esta votação na API de Dados Abertos. */
  sourceUrl: string;
  /** Quando o Observa leu este registro da fonte. */
  syncedAt: string;
};

/**
 * Registro individual de voto. A ausência de um Vote para um par
 * (votação, deputado) significa apenas "não há registro": não equivale a
 * ausência do parlamentar nem a voto contrário (PRD §8.1).
 */
export type Vote = {
  votingId: string;
  deputy: Deputy;
  /** Valor original da fonte (`tipoVoto`), preservado como veio. */
  value: string;
  /** Momento em que o voto foi registrado, quando a fonte informa. */
  recordedAt: string | null;
};

/** Resultado da consulta de voto, já distinguindo os casos não-voto. */
export type VoteLookup =
  | { kind: "registrado"; value: string }
  | { kind: "sem-registro" }
  | { kind: "sem-votos-individuais" };

/** Uma votação com tudo o que a interface precisa para exibi-la. */
export type VotingWithContext = {
  voting: Voting;
  proposition: Proposition | null;
  /**
   * Contagem vinda do arquivo anual, em três baldes: `Sim`, `Não` e `Outros`.
   *
   * `Outros` é um agregado da fonte — reúne abstenção, obstrução e artigo 17
   * sem separá-los. A quebra exata por valor só existe nos votos individuais,
   * carregados sob demanda ao abrir os detalhes. A interface precisa dizer
   * isso: tratar `Outros` como se fosse um valor de voto da fonte seria
   * inventar uma categoria (PRD §8.1).
   */
  tally: Array<{ value: string; count: number }>;
  /** Total de votos individuais publicados. */
  recordedVotes: number;
};
