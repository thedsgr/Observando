import { VoteMarker } from "@/components/ui/marker";
import { voteStyle } from "@/lib/vote-style";
import type { VoteLookup } from "@/lib/types";

/**
 * Exibe o voto de um parlamentar numa votação, distinguindo registro, ausência
 * de registro e ausência de votos individuais — os três casos que o PRD §8.1
 * proíbe confundir.
 */
export function VoteChip({ lookup }: { lookup: VoteLookup }) {
  if (lookup.kind === "sem-votos-individuais") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-xs text-text-muted"
        title="A fonte não publicou votos individuais nesta votação."
      >
        <VoteMarker marker="dashed" color="var(--vote-unrecorded)" />
        Sem votos individuais
      </span>
    );
  }

  if (lookup.kind === "sem-registro") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-xs text-text-muted"
        title="A Câmara não registrou voto deste parlamentar nesta votação. Isso não significa ausência nem voto contrário."
      >
        <VoteMarker marker="dashed" color="var(--vote-unrecorded)" />
        Sem registro
      </span>
    );
  }

  if (!lookup.value.trim()) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-flag/50 px-2.5 py-0.5 text-xs text-flag"
        title="A fonte registrou um voto para este parlamentar, mas sem valor. Não é ausência de registro, e o Observa não atribui um valor que a fonte não deu."
      >
        <VoteMarker marker="dashed" color="var(--flag)" />
        Valor não informado
      </span>
    );
  }

  const { color, marker } = voteStyle(lookup.value);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-xs"
      style={{ color }}
    >
      <VoteMarker marker={marker} color={color} />
      {/* Valor exatamente como veio da fonte (ex.: "Artigo 17"). */}
      {lookup.value}
    </span>
  );
}
