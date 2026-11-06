import type { RawTheme } from "@/lib/camara/raw";
import type { Confidence, TopicAssignment, TopicId } from "@/lib/types";

/**
 * Mapeamento dos temas oficiais da Câmara para a taxonomia do produto.
 *
 * A Câmara tem 32 temas (`/referencias/proposicoes/codTema`) e o Observa tem
 * 8 categorias. O PRD §8.2 manda priorizar metadado oficial e regra
 * determinística, então a classificação sai inteiramente desta tabela — não há
 * IA envolvida.
 *
 * Confiança:
 * - `alta`: correspondência direta entre o tema oficial e a categoria.
 * - `media`: o tema oficial é mais amplo que a categoria, ou se divide entre
 *   mais de uma. Esses casos aparecem na interface como "a confirmar".
 *
 * Temas oficiais ausentes desta tabela não geram categoria alguma: a votação
 * fica sem tema até revisão, em vez de receber um palpite (PRD §8.2).
 * Temas deliberadamente não mapeados: Administração Pública (34), Arte/Cultura
 * e Religião (35), Esporte e Lazer (39), Cidades e Desenvolvimento Urbano (41),
 * Direito Civil (42), Estrutura Fundiária (51), Processo Legislativo (53),
 * Relações Internacionais (55), Turismo (60), Agricultura (64), Indústria e
 * Comércio (66), Direito Constitucional (68), Homenagens (72), Política e
 * Eleições (74), Direito e Justiça (76), Ciências Exatas (85) e Ciências
 * Sociais (86).
 */
const THEME_TO_TOPIC: Record<number, { topicId: TopicId; confidence: Confidence }> = {
  56: { topicId: "saude", confidence: "alta" },
  46: { topicId: "educacao", confidence: "alta" },
  40: { topicId: "economia", confidence: "alta" },
  48: { topicId: "meio-ambiente", confidence: "alta" },
  61: { topicId: "transporte", confidence: "alta" },
  62: { topicId: "tecnologia", confidence: "alta" },
  57: { topicId: "seguranca-publica", confidence: "alta" },
  44: { topicId: "direitos-sociais", confidence: "alta" },

  // Temas oficiais mais amplos que a categoria do produto.
  70: { topicId: "economia", confidence: "media" }, // Finanças Públicas e Orçamento
  43: { topicId: "seguranca-publica", confidence: "media" }, // Direito Penal
  52: { topicId: "direitos-sociais", confidence: "media" }, // Previdência e Assistência
  58: { topicId: "direitos-sociais", confidence: "media" }, // Trabalho e Emprego
  67: { topicId: "direitos-sociais", confidence: "media" }, // Defesa do Consumidor
  54: { topicId: "meio-ambiente", confidence: "media" }, // Energia e Recursos Hídricos
  37: { topicId: "tecnologia", confidence: "media" }, // Comunicações
};

/**
 * Converte os temas oficiais de uma proposição nas categorias do produto.
 * Uma votação pode receber múltiplos temas (PRD §8.2) e temas não mapeados
 * simplesmente não aparecem.
 */
export function mapThemes(themes: RawTheme[]): TopicAssignment[] {
  const byTopic = new Map<TopicId, TopicAssignment>();

  for (const theme of themes) {
    const mapped = THEME_TO_TOPIC[theme.codTema];
    if (!mapped) continue;

    const existing = byTopic.get(mapped.topicId);
    // Se a mesma categoria vier por dois temas oficiais, fica a melhor confiança.
    if (existing && existing.confidence === "alta") continue;

    byTopic.set(mapped.topicId, {
      topicId: mapped.topicId,
      origin: "metadado-oficial",
      confidence: mapped.confidence,
      officialTheme: theme.tema,
    });
  }

  return [...byTopic.values()];
}
