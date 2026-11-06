import { VoteBar, VoteLegend } from "@/components/vote-bar";
import { OBJECT_KIND_LABEL } from "@/lib/camara/object-kind";
import { formatDateTime } from "@/lib/format";
import type { VotingWithContext } from "@/lib/types";

/**
 * Faixa de destaque da votação mais recente.
 *
 * Ocupa o lugar estrutural que a referência visual dá ao resultado da eleição,
 * mas o elemento central aqui é a atividade parlamentar (PRD §9.2).
 */
export function HeroStrip({
  item,
  syncLabel,
}: {
  item: VotingWithContext;
  syncLabel: string;
}) {
  const { voting, proposition, tally, recordedVotes } = item;

  return (
    <section className="rounded-panel border border-border-subtle bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-text-dim">
        <span>Votação mais recente</span>
        <time dateTime={voting.date} className="font-mono">
          {formatDateTime(voting.date)}
        </time>
        {voting.objectKind && (
          <span className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-text-muted">
            {OBJECT_KIND_LABEL[voting.objectKind.kind]}
          </span>
        )}
        {proposition && (
          <span className="font-mono text-accent">{proposition.label}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        {/* Ementas oficiais podem ter um parágrafo inteiro; a manchete mostra
            o começo e o texto completo fica na linha do feed e na fonte. */}
        <h1 className="line-clamp-3 max-w-3xl font-serif text-2xl leading-tight text-text sm:text-[30px]">
          {proposition?.title ?? voting.objectDescription}
        </h1>
        <div className="text-left sm:text-right">
          <span className="block text-xs text-text-dim">Resultado desta votação</span>
          <span className="block text-xl leading-tight text-text">
            {voting.result ?? "Não informado"}
          </span>
        </div>
      </div>

      {/* Descrição oficial do objeto, sempre visível na faixa */}
      <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-text-muted">
        {voting.objectDescription}
      </p>

      <div className="mt-5">
        {voting.hasIndividualVotes ? (
          <>
            <VoteBar tally={tally} size="lg" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <VoteLegend tally={tally} />
              <span className="font-mono text-xs text-text-dim">
                {recordedVotes} votos registrados
              </span>
            </div>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-border-strong px-4 py-3 text-sm text-text-muted">
            A fonte não publicou votos individuais nesta votação, então não há
            proporção a exibir e nenhum voto é atribuído a parlamentares.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border-subtle pt-3 text-xs text-text-dim">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: "var(--status)" }}
        />
        <span>Sincronizado {syncLabel}</span>
        <span aria-hidden>·</span>
        <span>atualização periódica, não em tempo real</span>
        <a
          href={voting.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-accent underline decoration-border-strong underline-offset-2 hover:decoration-accent"
        >
          Fonte oficial ↗
        </a>
      </div>
    </section>
  );
}
