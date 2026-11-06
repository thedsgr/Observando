import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatDate, formatDateTime } from "@/lib/format";
import type { coverageOf } from "@/lib/view";

/**
 * Cobertura do que foi lido da fonte.
 *
 * Mede o estado do dado, não o desempenho de parlamentares — rankings e
 * comparações entre deputados estão fora do MVP (PRD §6.2). Serve à
 * transparência operacional pedida em §5.6: dizer o que a fonte entregou
 * completo e o que ficou incerto.
 */
export function CoveragePanel({
  stats,
  coverageEnd,
  yearTotal,
  yearWithVotes,
}: {
  stats: ReturnType<typeof coverageOf>;
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
}) {
  const rows = [
    {
      label: "Com votos individuais",
      value: stats.withVotes,
      note: "a fonte publicou o voto de cada parlamentar",
    },
    {
      label: "Sem votos individuais",
      value: stats.withoutVotes,
      note: "a fonte não publicou voto por parlamentar",
    },
    {
      label: "Objeto não determinado",
      value: stats.undeterminedObject,
      note: "a descrição oficial não permitiu classificar o tipo do objeto",
    },
    {
      label: "Objeto a confirmar",
      value: stats.lowConfidenceObject,
      note: "tipo derivado com confiança média",
    },
    {
      label: "Tema a confirmar",
      value: stats.uncertainTopic,
      note: "o tema oficial é mais amplo que a categoria do produto",
    },
    {
      label: "Em Outros",
      value: stats.withoutTopic,
      note: "nenhum tema oficial corresponde às categorias do Observando",
    },
    {
      label: "Sem proposição",
      value: stats.withoutProposition,
      note: "a fonte não vinculou a votação a uma proposição identificável",
    },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Cobertura da base"
        caption="O que a fonte entregou completo e o que ficou incerto"
      />

      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-4xl leading-none text-text">{stats.total}</span>
        <span className="text-[13px] text-text-muted">votações lidas</span>
      </div>
      {stats.periodStart && stats.periodEnd && (
        <p className="mt-1.5 text-[13px] text-text-dim">
          {stats.recordedVotes} registros individuais de voto, de{" "}
          {formatDate(stats.periodStart)} a {formatDate(stats.periodEnd)}.
        </p>
      )}

      {/* O dado do ano inteiro contextualiza a janela do feed: votação com
          voto individual é exceção, não regra. */}
      <p className="mt-4 rounded-md border border-border-subtle bg-surface-2/60 px-3 py-2.5 text-[12px] leading-relaxed text-text-muted">
        No ano, <span className="font-mono text-text">{yearWithVotes}</span> de{" "}
        <span className="font-mono text-text">{yearTotal}</span> votações têm voto
        individual publicado —{" "}
        <span className="text-text">
          {Math.round((yearWithVotes / Math.max(yearTotal, 1)) * 1000) / 10}%
        </span>
        . O resto a Câmara registra sem identificar quem votou.
      </p>

      <dl className="mt-5 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-3 text-[13px]">
            <dt className="min-w-0 flex-1 truncate text-text-muted" title={row.note}>
              {row.label}
            </dt>
            <dd className="shrink-0 font-mono text-text">{row.value}</dd>
          </div>
        ))}
      </dl>

      {coverageEnd && (
        <p className="mt-4 border-t border-border-subtle pt-3 text-[12px] leading-relaxed text-text-dim">
          Os arquivos de dados abertos fecham no dia anterior. O registro mais
          recente neles é de{" "}
          <span className="font-mono">{formatDateTime(coverageEnd)}</span>, então
          votações de hoje ainda não aparecem aqui.
        </p>
      )}
    </Panel>
  );
}
