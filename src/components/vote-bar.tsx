import { VoteMarker } from "@/components/ui/marker";
import { OTHER_VOTES, voteStyle } from "@/lib/vote-style";

export type Tally = { value: string; count: number };

/**
 * Barra proporcional dos votos registrados numa votação.
 *
 * É o recurso de densidade principal do dashboard, mas tem um limite
 * deliberado: ela representa apenas os votos efetivamente registrados. Não
 * existe segmento para "sem registro", porque ausência de registro não é um
 * voto e não pode entrar numa proporção como se fosse (PRD §8.1).
 */
export function VoteBar({
  tally,
  size = "md",
}: {
  tally: Tally[];
  size?: "sm" | "md" | "lg";
}) {
  const total = tally.reduce((sum, entry) => sum + entry.count, 0);
  const height = size === "lg" ? "h-7" : size === "md" ? "h-2" : "h-1.5";

  if (total === 0) {
    return (
      <div
        className={`${height} w-full rounded-full border border-dashed border-border-strong`}
        title="Nenhum voto individual registrado nesta votação."
      />
    );
  }

  return (
    <div className={`${height} flex w-full gap-px overflow-hidden rounded-full`}>
      {tally.map((entry) => {
        const { color } = voteStyle(entry.value);
        const share = entry.count / total;
        return (
          <div
            key={entry.value}
            className="flex min-w-0 items-center justify-center first:rounded-l-full last:rounded-r-full"
            style={{ width: `${share * 100}%`, background: color }}
            title={`${entry.value}: ${entry.count} de ${total}`}
          >
            {size === "lg" && share > 0.2 && (
              <span className="truncate px-2 text-[11px] font-medium text-[#0d0d0f]">
                {entry.value} {entry.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Legenda da barra: marcador de forma, rótulo literal da fonte e contagem. */
export function VoteLegend({ tally }: { tally: Tally[] }) {
  const total = tally.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {tally.map((entry) => {
        const { color, marker } = voteStyle(entry.value);
        const aggregate = entry.value === OTHER_VOTES;
        return (
          <li
            key={entry.value}
            className="flex items-center gap-1.5 text-[13px]"
            title={
              aggregate
                ? "Agregado da fonte: reúne abstenção, obstrução e artigo 17 sem separá-los. A quebra exata aparece nos votos individuais."
                : undefined
            }
          >
            <VoteMarker marker={marker} color={color} />
            <span style={{ color }} className={aggregate ? "border-b border-dotted border-current" : undefined}>
              {entry.value}
            </span>
            <span className="font-mono text-text-muted">{entry.count}</span>
            <span className="font-mono text-text-dim">
              {total > 0 ? `${Math.round((entry.count / total) * 100)}%` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
