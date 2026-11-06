/**
 * Formato bruto das respostas da API de Dados Abertos da Câmara.
 * Os nomes seguem a API, incluindo esquisitices como `deputado_`.
 * Conferido contra respostas reais em 03/11/2026.
 */

export type Envelope<T> = {
  dados: T;
  links?: Array<{ rel: string; href: string }>;
};

export type RawVotingSummary = {
  id: string;
  uri: string;
  data: string;
  dataHoraRegistro: string;
  siglaOrgao: string | null;
  uriEvento: string | null;
  /** Vem `null` na maioria das votações; não dá para confiar nele. */
  proposicaoObjeto: string | null;
  uriProposicaoObjeto: string | null;
  /** Única descrição oficial do objeto votado, em prosa. */
  descricao: string;
  /** 1 = aprovado, 0 = rejeitado. */
  aprovacao: number | null;
};

export type RawAffectedProposition = {
  id: number;
  uri: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
};

export type RawVotingDetail = RawVotingSummary & {
  idOrgao: number | null;
  idEvento: number | null;
  descUltimaAberturaVotacao: string | null;
  /** Conjunto de objetos *candidatos*, não uma determinação do objeto votado. */
  objetosPossiveis: RawAffectedProposition[];
  proposicoesAfetadas: RawAffectedProposition[];
};

export type RawVote = {
  tipoVoto: string;
  dataRegistroVoto: string | null;
  deputado_: {
    id: number;
    nome: string;
    siglaPartido: string | null;
    siglaUf: string | null;
    urlFoto: string | null;
  };
};

export type RawDeputy = {
  id: number;
  nome: string;
  siglaPartido: string | null;
  siglaUf: string | null;
  urlFoto: string | null;
};

export type RawProposition = {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  ementaDetalhada: string | null;
  urlInteiroTeor: string | null;
  statusProposicao: {
    descricaoSituacao: string | null;
    descricaoTramitacao: string | null;
    dataHora: string | null;
  } | null;
};

export type RawTheme = {
  codTema: number;
  tema: string;
  relevancia: number;
};
