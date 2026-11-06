import type { Topic } from "@/lib/types";

/**
 * Taxonomia do produto (PRD §8.2). O mapeamento a partir dos 32 temas
 * oficiais da Câmara fica em src/lib/camara/topic-map.ts.
 *
 * As oito primeiras são a taxonomia inicial do PRD. As cinco seguintes
 * entraram porque, sem elas, votações com tema oficial conhecido — Direito
 * Civil, Política e Eleições — chegavam ao filtro como se não tivessem tema e
 * passavam por qualquer escolha. Foram escolhidas pelo peso nas votações
 * nominais, as que geram aviso, e com nome que dispensa conhecer o jargão.
 */
export const TOPICS: Topic[] = [
  { id: "saude", label: "Saúde" },
  { id: "educacao", label: "Educação" },
  { id: "economia", label: "Economia" },
  { id: "meio-ambiente", label: "Meio ambiente" },
  { id: "seguranca-publica", label: "Segurança pública" },
  { id: "direitos-sociais", label: "Direitos sociais" },
  { id: "transporte", label: "Transporte" },
  { id: "tecnologia", label: "Tecnologia" },
  { id: "justica", label: "Justiça" },
  { id: "politica", label: "Política e eleições" },
  { id: "campo", label: "Campo e agricultura" },
  { id: "governo", label: "Governo e serviço público" },
  { id: "cidades", label: "Cidades" },
];

export function topicLabel(id: Topic["id"]): string | undefined {
  return TOPICS.find((topic) => topic.id === id)?.label;
}
