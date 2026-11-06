/**
 * Aparência dos valores de voto, num só lugar, para que o chip, a barra de
 * proporção e a legenda nunca divirjam.
 *
 * Sim é verde e Não é vermelho, seguindo a convenção do painel de votação da
 * Câmara. Como esse par tem carga avaliativa e é o de pior distinção para
 * daltonismo, o marcador de forma e o rótulo textual são obrigatórios em todo
 * uso: a cor nunca carrega a informação sozinha (PRD §9.1, acessibilidade).
 * Nenhuma matiz aqui representa partido ou ideologia, e o texto do produto não
 * traduz "Sim" como "a favor do projeto" (PRD §8.1).
 */

/**
 * Rótulo do balde agregado da contagem (abstenção, obstrução e artigo 17
 * juntos). Na fonte ele se chama "Outros"; aqui leva "votos" para não se
 * confundir com a categoria de tema "Outros".
 */
export const OTHER_VOTES = "Outros votos";

export type Marker = "dot" | "ring" | "square" | "diamond" | "bar" | "dashed";

export type VoteStyle = {
  color: string;
  marker: Marker;
};

const KNOWN: Record<string, VoteStyle> = {
  sim: { color: "var(--vote-yes)", marker: "dot" },
  "não": { color: "var(--vote-no)", marker: "ring" },
  "abstenção": { color: "var(--vote-abstention)", marker: "square" },
  "obstrução": { color: "var(--vote-obstruction)", marker: "diamond" },
};

export function voteStyle(value: string): VoteStyle {
  return KNOWN[value.toLowerCase()] ?? { color: "var(--vote-other)", marker: "bar" };
}
