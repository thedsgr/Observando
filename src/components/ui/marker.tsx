import type { Marker } from "@/lib/vote-style";

/**
 * Marcador de forma que acompanha todo valor de voto, para que a distinção
 * não dependa de cor (PRD §9.1).
 */
export function VoteMarker({ marker, color }: { marker: Marker; color: string }) {
  const base = "inline-block shrink-0";
  switch (marker) {
    case "dot":
      return (
        <span aria-hidden className={`${base} size-2 rounded-full`} style={{ background: color }} />
      );
    case "ring":
      return (
        <span
          aria-hidden
          className={`${base} size-2 rounded-full border-[1.5px]`}
          style={{ borderColor: color }}
        />
      );
    case "square":
      return (
        <span aria-hidden className={`${base} size-2 rounded-[1px]`} style={{ background: color }} />
      );
    case "diamond":
      return (
        <span
          aria-hidden
          className={`${base} size-2 rotate-45 rounded-[1px]`}
          style={{ background: color }}
        />
      );
    case "dashed":
      return (
        <span
          aria-hidden
          className={`${base} size-2 rounded-full border border-dashed`}
          style={{ borderColor: color }}
        />
      );
    case "bar":
      return (
        <span aria-hidden className={`${base} h-[2px] w-2 rounded-full`} style={{ background: color }} />
      );
  }
}
