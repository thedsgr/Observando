import type { Topic } from "@/lib/types";

/** Taxonomia do produto (PRD §8.2). O mapeamento a partir dos 32 temas
 *  oficiais da Câmara fica em src/lib/camara/topic-map.ts. */
export const TOPICS: Topic[] = [
  { id: "saude", label: "Saúde" },
  { id: "educacao", label: "Educação" },
  { id: "economia", label: "Economia" },
  { id: "meio-ambiente", label: "Meio ambiente" },
  { id: "seguranca-publica", label: "Segurança pública" },
  { id: "direitos-sociais", label: "Direitos sociais" },
  { id: "transporte", label: "Transporte" },
  { id: "tecnologia", label: "Tecnologia" },
];

export function topicLabel(id: Topic["id"]): string | undefined {
  return TOPICS.find((topic) => topic.id === id)?.label;
}
