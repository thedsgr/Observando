"use client";

import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { VoteChip } from "@/components/vote-chip";
import { deputyCaption, formatDate } from "@/lib/format";
import type { FollowedLegislator } from "@/lib/preferences";
import type { VotingWithContext } from "@/lib/types";

/**
 * Painel dos parlamentares acompanhados, com o voto mais recente de cada um.
 *
 * É o que o produto promete na porta de entrada, então vai no topo da coluna
 * de contexto. Quando ainda não há registro de alguém na janela carregada, o
 * painel diz isso — nunca deixa em branco, para não sugerir que a pessoa
 * deixou de votar.
 */
export function FollowedPanel({
  legislators,
  votings,
  deputyVotes,
  loading,
}: {
  legislators: FollowedLegislator[];
  votings: VotingWithContext[];
  deputyVotes: Record<string, Record<string, string>> | null;
  loading: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Seus parlamentares"
        caption="O voto mais recente de cada um"
        aside={
          <Link
            href="/preferencias"
            className="text-xs text-accent hover:text-accent-hover"
          >
            editar
          </Link>
        }
      />

      <ul className="space-y-3">
        {legislators.map((legislator) => {
          // A votação mais recente em que há registro deste parlamentar.
          const latest = deputyVotes
            ? votings.find(
                (item) =>
                  deputyVotes[item.voting.id]?.[String(legislator.externalId)] !==
                  undefined,
              )
            : undefined;
          const value = latest
            ? deputyVotes?.[latest.voting.id]?.[String(legislator.externalId)]
            : undefined;

          return (
            <li
              key={legislator.externalId}
              className="border-b border-border-subtle pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-text">
                    {legislator.name}
                  </span>
                  <span className="block font-mono text-[11px] text-text-dim">
                    {deputyCaption(legislator.party, legislator.uf)}
                  </span>
                </span>
                {value !== undefined && (
                  <VoteChip lookup={{ kind: "registrado", value }} />
                )}
              </div>

              {loading ? (
                <p className="mt-1.5 text-[12px] text-text-dim">Consultando…</p>
              ) : latest ? (
                <p className="mt-1.5 text-[12px] leading-snug text-text-muted">
                  <span className="font-mono text-text-dim">
                    {formatDate(latest.voting.date)}
                  </span>{" "}
                  · {latest.proposition?.label ?? "proposição não identificada"} —{" "}
                  {latest.voting.result ?? "sem resultado informado"}
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] leading-snug text-text-dim">
                  Sem registro de voto nas votações carregadas. Isso não
                  significa que deixou de votar.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
