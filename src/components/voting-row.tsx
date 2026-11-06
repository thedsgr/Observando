"use client";

import { useState } from "react";
import { NoTopicChip, TopicChip } from "@/components/topic-chip";
import { VoteBar, VoteLegend } from "@/components/vote-bar";
import { VoteChip } from "@/components/vote-chip";
import { ErrorState } from "@/components/states";
import {
  OBJECT_KIND_LABEL,
  OBJECT_KIND_NOTE,
  UNDETERMINED_OBJECT_NOTE,
} from "@/lib/camara/object-kind";
import { deputyCaption, formatDate, formatTime } from "@/lib/format";
import { lookupVote, type DeputyVotes } from "@/lib/view";
import type { Vote, VotingWithContext } from "@/lib/types";

/** Parlamentar cujo voto aparece em destaque na linha. */
export type HighlightedLegislator = {
  externalId: number;
  name: string;
};

type Props = {
  item: VotingWithContext;
  /** Parlamentares em foco: os acompanhados, ou um escolhido na busca. */
  highlighted?: HighlightedLegislator[];
  deputyVotes?: DeputyVotes | null;
};

type VotesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; votes: Vote[] }
  | { status: "error" };

/**
 * Linha do feed de votações.
 *
 * A linha fechada é densa de propósito. O que o PRD §8.1 exige e não cabe nela
 * — a nota sobre o objeto votado, resultado × situação da proposição, os votos
 * individuais e a fonte — fica em divulgação progressiva.
 *
 * Os votos individuais só são buscados quando o usuário abre os detalhes: uma
 * votação nominal tem centenas de registros e trazê-los no feed inteiro seria
 * megabytes por página.
 */
export function VotingRow({ item, highlighted, deputyVotes }: Props) {
  const [open, setOpen] = useState(false);
  const [votes, setVotes] = useState<VotesState>({ status: "idle" });
  const { voting, proposition, tally, recordedVotes } = item;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || votes.status !== "idle" || !voting.hasIndividualVotes) return;

    setVotes({ status: "loading" });
    try {
      const response = await fetch(
        `/api/votacoes/${encodeURIComponent(voting.id)}/votos`,
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { votes: Vote[] };
      setVotes({ status: "loaded", votes: body.votes });
    } catch {
      setVotes({ status: "error" });
    }
  }

  return (
    <article className="group grid grid-cols-1 gap-x-4 border-b border-border-subtle px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-2/40 sm:grid-cols-[62px_1fr] sm:px-5">
      {/* Calha de data */}
      <div className="mb-1 flex items-baseline gap-2 font-mono text-xs text-text-dim sm:mb-0 sm:block sm:pt-0.5">
        <time dateTime={voting.date} className="block">
          {formatDate(voting.date)}
        </time>
        <span className="block text-text-dim/70">{formatTime(voting.date)}</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
          {proposition ? (
            <span className="font-mono text-accent">{proposition.label}</span>
          ) : (
            <span
              className="font-mono text-text-dim"
              title="A fonte não vinculou esta votação a uma proposição identificável."
            >
              proposição não identificada
            </span>
          )}
          {voting.objectKind ? (
            <span
              className={[
                "rounded-full border px-2 py-0.5",
                voting.objectKind.confidence === "alta"
                  ? "border-border-subtle bg-surface-2 text-text-muted"
                  : "border-dashed border-flag/50 text-flag",
              ].join(" ")}
              title={`Derivado da descrição oficial a partir de “${voting.objectKind.basis}” · confiança ${voting.objectKind.confidence}`}
            >
              {OBJECT_KIND_LABEL[voting.objectKind.kind]}
            </span>
          ) : (
            <span
              className="rounded-full border border-dashed border-border-strong px-2 py-0.5 text-text-dim"
              title={UNDETERMINED_OBJECT_NOTE}
            >
              Objeto não determinado
            </span>
          )}
          {!voting.hasIndividualVotes && (
            <span
              className="rounded-full border border-dashed border-border-strong px-2 py-0.5 text-text-muted"
              title="A fonte não publicou votos individuais nesta votação."
            >
              Sem votos individuais
            </span>
          )}
          <span className="ml-auto text-text">
            {voting.result ?? "Resultado não informado"}
          </span>
        </div>

        {proposition && (
          <h3
            className={[
              "mt-1.5 text-[15px] leading-snug text-text",
              open ? "" : "line-clamp-2",
            ].join(" ")}
          >
            {proposition.title}
          </h3>
        )}

        {/* Descrição oficial do objeto votado, literal */}
        <p
          className={[
            "mt-1 text-[13px] leading-relaxed text-text-muted",
            open ? "" : "line-clamp-2",
          ].join(" ")}
        >
          {voting.objectDescription}
        </p>

        {voting.hasIndividualVotes && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="w-full max-w-[180px] shrink-0">
              <VoteBar tally={tally} />
            </span>
            <VoteLegend tally={tally} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {voting.topics.length > 0 ? (
            voting.topics.map((assignment) => (
              <TopicChip key={assignment.topicId} assignment={assignment} />
            ))
          ) : (
            <NoTopicChip />
          )}

          {highlighted?.map((legislator) => (
            <span
              key={legislator.externalId}
              className="flex items-center gap-2 rounded-full border border-border-strong bg-surface-2 py-0.5 pl-2.5 pr-1"
            >
              <span className="text-xs text-text-muted">{legislator.name}</span>
              <VoteChip
                lookup={lookupVote(item, deputyVotes ?? null, legislator.externalId)}
              />
            </span>
          ))}

          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs text-text-dim transition-colors hover:border-border-subtle hover:text-accent"
          >
            {open ? "Menos" : "Detalhes"}
            <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
              ›
            </span>
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-4 rounded-md border border-border-subtle bg-surface-2/60 p-4">
            {/* O que o voto significava */}
            <p className="text-[13px] leading-relaxed text-flag/85">
              {voting.objectKind
                ? OBJECT_KIND_NOTE[voting.objectKind.kind]
                : UNDETERMINED_OBJECT_NOTE}
            </p>

            {/* Ambiguidade do objeto, declarada em vez de escondida */}
            {voting.objectCandidates > 1 && (
              <p className="text-[12px] leading-relaxed text-text-dim">
                A fonte lista{" "}
                <span className="font-mono text-text-muted">
                  {voting.objectCandidates}
                </span>{" "}
                objetos candidatos a esta votação e não diz qual foi submetido a
                voto. O tipo acima vem da descrição oficial, não do cadastro.
              </p>
            )}

            {/* Os dois fatos que o resultado não diz sozinho */}
            <dl className="grid gap-3 border-y border-border-subtle py-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-dim">
                  Resultado desta votação
                </dt>
                <dd className="mt-0.5 text-[13px] text-text">
                  {voting.result ?? "Não informado pela fonte"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-dim">
                  Situação da proposição
                </dt>
                <dd className="mt-0.5 text-[13px] text-text">
                  {proposition?.status ?? "Não informada pela fonte"}
                </dd>
              </div>
            </dl>

            {voting.hasIndividualVotes ? (
              <IndividualVotes state={votes} total={recordedVotes} tally={tally} />
            ) : (
              <p className="text-[13px] leading-relaxed text-text-dim">
                A fonte não publicou votos individuais nesta votação, então o
                Observa não atribui voto a nenhum parlamentar. Não é possível
                afirmar, a partir do dado disponível, se a votação foi simbólica
                ou se os registros ainda não foram divulgados.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <a
                href={voting.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-border-strong underline-offset-2 hover:decoration-accent"
              >
                Registro oficial da votação ↗
              </a>
              {proposition && (
                <a
                  href={proposition.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-border-strong underline-offset-2 hover:decoration-accent"
                >
                  Tramitação da proposição ↗
                </a>
              )}
              <span className="font-mono text-text-dim">votação {voting.id}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function IndividualVotes({
  state,
  total,
  tally,
}: {
  state: VotesState;
  total: number;
  tally: Array<{ value: string; count: number }>;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <p className="text-[13px] text-text-dim" aria-busy="true">
        Carregando os {total} votos registrados…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState description="Os votos individuais desta votação não puderam ser lidos na fonte oficial." />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-text-dim">
          {state.votes.length} votos registrados
        </span>
        <VoteLegend tally={tally} />
      </div>
      <ul className="mt-3 grid max-h-96 gap-x-6 gap-y-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {state.votes.map((vote) => (
          <li
            key={vote.deputy.id}
            className="flex items-center justify-between gap-3 border-b border-border-subtle pb-1.5 text-[13px]"
          >
            <span className="min-w-0">
              <span className="block truncate text-text">{vote.deputy.name}</span>
              <span className="block truncate font-mono text-[11px] text-text-dim">
                {deputyCaption(vote.deputy.party, vote.deputy.uf)}
              </span>
            </span>
            <VoteChip lookup={{ kind: "registrado", value: vote.value }} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-text-dim">
        A lista contém apenas os votos que constam no registro oficial. A
        ausência de um parlamentar nela não significa que ele faltou nem que
        votou contra.
      </p>
    </div>
  );
}
