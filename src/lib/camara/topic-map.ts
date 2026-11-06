import type { RawTheme } from "@/lib/camara/raw";
import type { Confidence, TopicAssignment, TopicId } from "@/lib/types";

/**
 * Mapeamento dos temas oficiais da Câmara para a taxonomia do produto.
 *
 * A Câmara tem 32 temas (`/referencias/proposicoes/codTema`) e o Observando tem
 * 13 categorias. O PRD §8.2 manda priorizar metadado oficial e regra
 * determinística, então a classificação sai inteiramente desta tabela — não há
 * IA envolvida.
 *
 * Confiança:
 * - `alta`: correspondência direta entre o tema oficial e a categoria.
 * - `media`: o tema oficial é mais amplo que a categoria, ou se divide entre
 *   mais de uma. Esses casos aparecem na interface como "a confirmar".
 *
 * Temas oficiais ausentes desta tabela não geram categoria: quando nenhum
 * tema da proposição está aqui (ou ela não tem tema), a votação vai para
 * "Outros", e não para a categoria mais parecida — palpite seria pior
 * (PRD §8.2).
 * Temas deliberadamente não mapeados: Arte/Cultura e Religião (35), Esporte e
 * Lazer (39), Relações Internacionais (55), Turismo (60), Homenagens (72),
 * Ciências Exatas (85) e Ciências Sociais (86). Nenhum aparece sozinho numa
 * votação nominal de 2026, então não mudam aviso. Homenagens é o maior grupo
 * do ano (284 votações só com ele) e fica de fora de propósito: lei que dá
 * título a município não é assunto que alguém queira receber.
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
  66: { topicId: "economia", confidence: "media" }, // Indústria, Comércio e Serviços

  // Categorias acrescentadas à taxonomia inicial. Pesos nas votações
  // nominais de 2026 que antes ficavam sem categoria: Direito Civil 15,
  // Política e Eleições 8, Administração Pública 3, Agricultura 2, Estrutura
  // Fundiária 2, Cidades 2, Direito e Justiça 2.
  76: { topicId: "justica", confidence: "alta" }, // Direito e Justiça
  42: { topicId: "justica", confidence: "media" }, // Direito Civil e Processual Civil
  68: { topicId: "justica", confidence: "media" }, // Direito Constitucional
  74: { topicId: "politica", confidence: "alta" }, // Política, Partidos e Eleições
  53: { topicId: "politica", confidence: "media" }, // Processo Legislativo e Atuação Parlamentar
  64: { topicId: "campo", confidence: "alta" }, // Agricultura, Pecuária, Pesca e Extrativismo
  51: { topicId: "campo", confidence: "media" }, // Estrutura Fundiária
  34: { topicId: "governo", confidence: "alta" }, // Administração Pública
  41: { topicId: "cidades", confidence: "alta" }, // Cidades e Desenvolvimento Urbano
};

/**
 * Converte os temas oficiais de uma proposição nas categorias do produto.
 * Uma votação pode receber múltiplos temas (PRD §8.2). Temas não mapeados não
 * aparecem; se nenhum for mapeado, a votação recebe "Outros", com os temas
 * oficiais que tinha (se tinha) guardados para auditoria.
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

  if (byTopic.size === 0) {
    const official = themes.map((theme) => theme.tema).filter(Boolean);
    return [
      {
        topicId: "outros",
        // Regra, não metadado: a Câmara não disse "outros", foi a ausência de
        // correspondência que decidiu. E é certeza, não palpite.
        origin: "regra",
        confidence: "alta",
        ...(official.length > 0 ? { officialTheme: official.join("; ") } : {}),
      },
    ];
  }

  return [...byTopic.values()];
}
