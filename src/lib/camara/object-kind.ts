import type { ObjectKindAssignment, VotingObjectKind } from "@/lib/types";

/**
 * Determina o tipo do objeto votado.
 *
 * Há dois caminhos, nesta ordem de prioridade:
 *
 * 1. `votacoesObjetos-{ano}.csv` dá o tipo **estruturado** do objeto. Quando a
 *    votação tem exatamente um objeto listado, isso é uma determinação, e a
 *    confiança é alta. Em 2026 isso cobre 60% das votações — mas só 17% das
 *    nominais, porque as votações de plenário costumam ter vários objetos
 *    candidatos. Por isso o segundo caminho continua necessário.
 *
 * 2. A descrição oficial em prosa, por regras explícitas. A API REST não tem
 *    campo para o objeto (`proposicaoObjeto` vem `null` quase sempre e
 *    `objetosPossiveis` é um conjunto de candidatos), então quando o arquivo é
 *    ambíguo esta é a única pista.
 *
 * Como o PRD §8.1 proíbe confundir voto em emenda ou destaque com voto no
 * projeto inteiro, a derivação é conservadora e devolve `null` quando nada se
 * aplica. A descrição oficial é sempre exibida junto, então o usuário nunca
 * depende desta classificação para saber o que foi votado.
 */

/**
 * Siglas de tipo de proposição usadas como objeto de votação.
 * As descrições são as oficiais, lidas de `descricaoTipo` em
 * `proposicoes-2026.csv` — a API REST de referências estava indisponível.
 */
const TYPE_TO_KIND: Record<string, VotingObjectKind> = {
  // "Votação Nominal do Destaque para Votação em Separado" — o objeto mais
  // frequente nos arquivos de 2026.
  RPD: "destaque",
  DTQ: "destaque", // Destaque para Votação em Separado
  EMP: "emenda", // Emenda de Plenário a Projeto com Urgência
  EMR: "emenda", // Emenda de Relator
  ERD: "emenda", // Emenda de Redação em Plenário
  SBT: "substitutivo", // Substitutivo
  RDF: "redacao-final", // Redação Final
  PRL: "parecer", // Parecer do Relator
  PRLP: "parecer", // Parecer Preliminar de Plenário
  PRLE: "parecer", // Parecer Preliminar às Emendas de Plenário
  PAR: "parecer", // Parecer de Comissão
  PPP: "parecer", // Parecer Proferido em Plenário
  PEP: "parecer", // Parecer às Emendas de Plenário
  REQ: "requerimento", // Requerimento
  REC: "recurso", // Recurso contra apreciação conclusiva de comissão
  PL: "texto-principal", // Projeto de Lei
  PLP: "texto-principal", // Projeto de Lei Complementar
  PEC: "texto-principal", // Proposta de Emenda à Constituição
  MPV: "texto-principal", // Medida Provisória
  PDL: "texto-principal", // Projeto de Decreto Legislativo
};

/**
 * Tipo do objeto a partir do tipo estruturado do arquivo. Só deve ser chamado
 * quando a votação tem **um único** objeto listado: com vários, o arquivo não
 * determina qual foi submetido a voto.
 */
export function deriveObjectKindFromType(
  siglaTipo: string,
): ObjectKindAssignment | null {
  const kind = TYPE_TO_KIND[siglaTipo.trim().toUpperCase()];
  if (!kind) return null;
  return { kind, confidence: "alta", basis: `tipo oficial do objeto: ${siglaTipo}` };
}

type Rule = {
  pattern: RegExp;
  kind: VotingObjectKind;
  confidence: ObjectKindAssignment["confidence"];
};

/* A ordem importa: a primeira regra que casar vence. As mais específicas
   vêm antes das mais genéricas. */
const RULES: Rule[] = [
  { pattern: /\bredaç(ão|ao) final\b/i, kind: "redacao-final", confidence: "alta" },
  // O objeto no começo da frase manda. "Rejeitada a Emenda ao Substitutivo"
  // votou a emenda; o substitutivo ali é só aquilo a que ela se refere. Sem
  // esta regra antes da de substitutivo, onze votações de 2026 eram
  // apresentadas como votação do texto inteiro. A exceção do lookahead é
  // "Subemenda Substitutiva" e "Emenda Aglutinativa Substitutiva", que trocam
  // o texto todo e são substitutivo de fato.
  {
    pattern:
      /^\s*(?:aprovad|rejeitad)[oa]s?\s+(?:a|as)\s+(?:sub)?emendas?\b(?!\s+(?:aglutinativa\s+)?substitutiv)/i,
    kind: "emenda",
    confidence: "alta",
  },
  // Feminino também: a Câmara escreve "Subemenda Substitutiva" e "Emenda
  // Aglutinativa Substitutiva", e as duas trocam o texto inteiro. Só com o
  // masculino, quatro votações nominais de 2026 viravam "texto principal" e
  // uma de PEC virava "emenda: alteração pontual".
  { pattern: /\bsubstitutiv[oa]s?\b/i, kind: "substitutivo", confidence: "alta" },
  { pattern: /\bdestaque|votaç(ão|ao) em separado\b/i, kind: "destaque", confidence: "alta" },
  { pattern: /\bemenda(s)?\b/i, kind: "emenda", confidence: "alta" },
  { pattern: /\brequerimento\b/i, kind: "requerimento", confidence: "alta" },
  { pattern: /\brecurso\b/i, kind: "recurso", confidence: "alta" },
  { pattern: /\bparecer\b/i, kind: "parecer", confidence: "alta" },
  {
    pattern: /\b(encaminhamento|adiamento|retirada de pauta|quest(ão|ao) de ordem|prejudicialidade)\b/i,
    kind: "procedimental",
    confidence: "alta",
  },
  /* "Projeto de Lei" sem nenhum qualificador acima: provavelmente o texto
     principal, mas a descrição pode omitir que havia substitutivo em jogo. */
  {
    pattern: /\b(projeto de lei|projeto de decreto|proposta de emenda (à|a) constituiç(ão|ao)|medida provis(ó|o)ria)\b/i,
    kind: "texto-principal",
    confidence: "media",
  },
];

/**
 * "Aprovado o Projeto de Lei nº 6.139, de 2023, ressalvado o destaque."
 *
 * A ressalva diz o que NÃO entrou nesta votação — os destaques ficam para
 * votações separadas. Lida como pista, ela fazia a regra de destaque casar e a
 * votação que aprovou o texto virava "um trecho, não a proposta inteira": o
 * contrário do que aconteceu. Seis votações nominais de 2026 caíam nisso.
 */
const RESSALVA = /,?\s*ressalvad[oa]s?(?:\(s\))?\s[^.;]*/gi;

export function deriveObjectKind(description: string): ObjectKindAssignment | null {
  const relevant = description.replace(RESSALVA, "");
  for (const rule of RULES) {
    const match = rule.pattern.exec(relevant);
    if (match) {
      return { kind: rule.kind, confidence: rule.confidence, basis: match[0] };
    }
  }
  return null;
}

export const OBJECT_KIND_LABEL: Record<VotingObjectKind, string> = {
  "texto-principal": "Texto principal",
  substitutivo: "Substitutivo",
  "redacao-final": "Redação final",
  emenda: "Emenda",
  destaque: "Destaque",
  requerimento: "Requerimento",
  parecer: "Parecer",
  recurso: "Recurso",
  procedimental: "Procedimental",
};

/**
 * Explicação do que o voto significava, para o usuário não presumir que toda
 * votação é sobre "o projeto inteiro" (PRD §8.1).
 */
export const OBJECT_KIND_NOTE: Record<VotingObjectKind, string> = {
  "texto-principal":
    "O voto foi sobre o texto submetido nesta etapa, que pode não ser a versão final da proposta.",
  substitutivo:
    "O voto foi sobre um texto substitutivo, que troca a redação original da proposta — não sobre a proposta como foi apresentada.",
  "redacao-final":
    "O voto foi sobre a redação final, a etapa que apenas confirma a forma do texto já aprovado antes.",
  emenda:
    "O voto foi sobre uma emenda, isto é, uma alteração pontual — não sobre a proposta inteira.",
  destaque:
    "O voto foi sobre um trecho destacado para votação separada — não sobre a proposta inteira.",
  requerimento:
    "O voto foi sobre um requerimento, que trata do andamento dos trabalhos — não sobre o conteúdo da proposta.",
  parecer:
    "O voto foi sobre o parecer de uma comissão ou relatoria, que recomenda um encaminhamento para a proposta.",
  recurso:
    "O voto foi sobre um recurso regimental, que questiona uma decisão anterior sobre a tramitação.",
  procedimental:
    "O voto foi sobre uma questão de procedimento da sessão — não sobre o conteúdo da proposta.",
};

/** Texto exibido quando nenhuma regra determinou o tipo do objeto. */
export const UNDETERMINED_OBJECT_NOTE =
  "A fonte não traz um campo estruturado para o tipo do objeto votado, e a descrição oficial não permitiu determiná-lo com segurança. Leia a descrição acima e confira a fonte antes de concluir o que foi votado.";
