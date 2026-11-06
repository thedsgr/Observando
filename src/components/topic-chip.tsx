import { topicLabel } from "@/lib/topics";
import type { TopicAssignment } from "@/lib/types";

const ORIGIN_LABEL: Record<TopicAssignment["origin"], string> = {
  "metadado-oficial": "tema oficial da Câmara",
  regra: "regra determinística",
  ia: "classificação automática",
};

/**
 * Tema atribuído a uma votação. Quando a confiança não é alta — porque o tema
 * oficial é mais amplo que a categoria do produto — o chip é marcado visual e
 * textualmente: o PRD §8.2 proíbe apresentar classificação ambígua como certa.
 */
export function TopicChip({ assignment }: { assignment: TopicAssignment }) {
  const label = topicLabel(assignment.topicId);
  if (!label) return null;

  const uncertain = assignment.confidence !== "alta";
  const source = assignment.officialTheme
    ? `${ORIGIN_LABEL[assignment.origin]}: “${assignment.officialTheme}”`
    : ORIGIN_LABEL[assignment.origin];
  // "Outros" não foi atribuído por correspondência, e sim pela falta dela.
  const title =
    assignment.topicId === "outros"
      ? assignment.officialTheme
        ? `Nenhum tema oficial desta proposição corresponde às categorias do Observa. Temas oficiais: ${assignment.officialTheme}`
        : "A fonte não informa tema oficial para esta votação."
      : `Atribuído por ${source} · confiança ${assignment.confidence}`;

  return (
    <span
      title={title}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        uncertain
          ? "border-dashed border-flag/50 text-flag"
          : "border-border-subtle bg-surface-2 text-text-muted",
      ].join(" ")}
    >
      {label}
      {uncertain && (
        <span className="text-[10px] uppercase tracking-wide opacity-80">
          a confirmar
        </span>
      )}
    </span>
  );
}

/**
 * Votação ainda não classificada. Depois da sincronização toda votação tem ao
 * menos "Outros"; isto cobre o intervalo antes dela.
 */
export function NoTopicChip() {
  return (
    <span
      title="Esta votação ainda não foi classificada por tema."
      className="inline-flex items-center rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-xs text-text-dim"
    >
      Sem tema
    </span>
  );
}
