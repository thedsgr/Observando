"use client";

import { MeterRow, Panel, PanelHeader } from "@/components/ui/panel";
import type { topicCounts } from "@/lib/view";
import type { TopicId } from "@/lib/types";

/**
 * Distribuição das votações por tema, a partir dos temas oficiais da Câmara.
 *
 * O filtro apenas prioriza a leitura: não oculta histórico, e o painel diz
 * isso, porque os temas não podem funcionar como recorte que esconde votações
 * do parlamentar (PRD §8.2).
 */
export function TopicsPanel({
  counts,
  selected,
  onSelect,
}: {
  counts: ReturnType<typeof topicCounts>;
  selected: TopicId | null;
  onSelect: (topicId: TopicId | null) => void;
}) {
  const max = Math.max(1, ...counts.map((entry) => entry.count));

  return (
    <Panel>
      <PanelHeader
        title="Votações por tema"
        caption="Clique para priorizar um tema no feed"
        aside={
          selected && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs text-accent hover:text-accent-hover"
            >
              limpar
            </button>
          )
        }
      />

      <ul className="space-y-2.5">
        {counts.map(({ topic, count, uncertain }) => {
          const active = selected === topic.id;
          return (
            <li key={topic.id}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : topic.id)}
                aria-pressed={active}
                className="w-full rounded-sm text-left"
                style={{ opacity: selected && !active ? 0.45 : 1 }}
              >
                <MeterRow
                  label={
                    <span className={active ? "text-accent" : undefined}>
                      {topic.label}
                      {uncertain > 0 && (
                        <span
                          className="ml-1.5 text-flag"
                          title={`${uncertain} com classificação a confirmar`}
                        >
                          ·
                        </span>
                      )}
                    </span>
                  }
                  value={count}
                  ratio={count / max}
                  color={active ? "var(--accent)" : "var(--border-strong)"}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-border-subtle pt-3 text-[12px] leading-relaxed text-text-dim">
        Os temas vêm do cadastro oficial da proposição na Câmara, mapeado para
        as categorias do Observando. O ponto âmbar marca temas oficiais mais amplos
        que a categoria, que ainda precisam de confirmação.
      </p>
    </Panel>
  );
}
