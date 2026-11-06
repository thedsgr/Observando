import { Panel, PanelHeader } from "@/components/ui/panel";
import { OBJECT_KIND_LABEL } from "@/lib/camara/object-kind";
import { formatTime } from "@/lib/format";
import type { VotingWithContext } from "@/lib/types";

/**
 * Registro cronológico das votações lidas na última sincronização.
 * Cada linha é um fato verificável, nunca uma interpretação do resultado.
 */
export function UpdatesPanel({ items }: { items: VotingWithContext[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Últimas atualizações"
        caption="Votações lidas na última sincronização"
      />

      <ol className="space-y-3.5">
        {items.slice(0, 6).map(({ voting, proposition }) => (
          <li key={voting.id} className="flex gap-3">
            <time
              dateTime={voting.date}
              className="w-10 shrink-0 pt-0.5 font-mono text-xs text-text-dim"
            >
              {formatTime(voting.date)}
            </time>
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{
                background: voting.hasIndividualVotes
                  ? "var(--status)"
                  : "var(--vote-unrecorded)",
              }}
            />
            <p className="min-w-0 text-[13px] leading-snug text-text-muted">
              {proposition && (
                <span className="font-mono text-accent">{proposition.label} </span>
              )}
              {voting.objectKind && (
                <span className="text-text-dim">
                  {OBJECT_KIND_LABEL[voting.objectKind.kind].toLowerCase()}{" "}
                </span>
              )}
              — <span className="text-text">{voting.result ?? "sem resultado informado"}</span>
              {!voting.hasIndividualVotes && (
                <span className="text-text-dim"> · sem votos individuais</span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
