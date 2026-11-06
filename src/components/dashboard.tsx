"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeroStrip } from "@/components/hero-strip";
import { AboutPanel } from "@/components/panels/about-panel";
import { CoveragePanel } from "@/components/panels/coverage-panel";
import { FollowedPanel } from "@/components/panels/followed-panel";
import { TopicsPanel } from "@/components/panels/topics-panel";
import { UpdatesPanel } from "@/components/panels/updates-panel";
import { SearchModal } from "@/components/search-modal";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/states";
import { Panel } from "@/components/ui/panel";
import { VotingRow, type HighlightedLegislator } from "@/components/voting-row";
import { TOPICS } from "@/lib/topics";
import { deputyCaption, formatDateTime } from "@/lib/format";
import {
  coverageOf,
  filterVotings,
  topicCounts,
  type DeputyVotes,
} from "@/lib/view";
import type { Preferences } from "@/lib/preferences";
import type { Deputy, TopicId, VotingWithContext } from "@/lib/types";

type Props = {
  votings: VotingWithContext[];
  deputies: Deputy[];
  syncedAt: string;
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
  /** Acompanhamento configurado. Ausente = visitante sem configuração. */
  preferences?: Preferences | null;
};

/**
 * Painel principal.
 *
 * Serve a dois estados: o visitante que ainda não configurou nada vê o
 * panorama público, e quem já configurou vê o próprio acompanhamento — os
 * parlamentares escolhidos no topo e o feed já recortado pelos temas dele.
 */
export function Dashboard({
  votings,
  deputies,
  syncedAt,
  coverageEnd,
  yearTotal,
  yearWithVotes,
  preferences,
}: Props) {
  const followed = useMemo(
    () => preferences?.legislators ?? [],
    [preferences?.legislators],
  );
  const isPersonal = followed.length > 0;

  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [searched, setSearched] = useState<Deputy | null>(null);
  /**
   * Resultado do cruzamento, carimbado com a chave dos parlamentares que o
   * originou. Guardar a chave junto evita um estado separado de "carregando":
   * ele é derivado de a chave bater ou não com a atual, e assim nenhum estado
   * precisa ser atribuído de forma síncrona dentro do efeito.
   */
  const [crossRef, setCrossRef] = useState<{
    key: string;
    votes: DeputyVotes | null;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Quem configurou acompanhamento começa vendo só o próprio recorte. */
  const [onlyMine, setOnlyMine] = useState(isPersonal);
  const [onlyWithVotes, setOnlyWithVotes] = useState(false);

  const syncLabel = formatDateTime(syncedAt);
  const coverage = useMemo(() => coverageOf(votings), [votings]);
  const counts = useMemo(() => topicCounts(votings), [votings]);
  const latest = votings[0];

  /** Todos os parlamentares cujo voto precisamos cruzar. */
  const trackedIds = useMemo(() => {
    const ids = followed.map((item) => item.externalId);
    if (searched) ids.push(searched.id);
    return [...new Set(ids)].sort((a, b) => a - b);
  }, [followed, searched]);

  const trackedKey = trackedIds.join(",");
  const deputyVotes = crossRef?.key === trackedKey ? crossRef.votes : null;
  const loadingVotes = trackedIds.length > 0 && crossRef?.key !== trackedKey;

  const highlighted: HighlightedLegislator[] = useMemo(() => {
    const list: HighlightedLegislator[] = followed.map((item) => ({
      externalId: item.externalId,
      name: item.name,
    }));
    if (searched && !list.some((item) => item.externalId === searched.id)) {
      list.push({ externalId: searched.id, name: searched.name });
    }
    return list;
  }, [followed, searched]);

  // Cruzamento parlamentar × votações, no servidor, sobre os votos em cache.
  useEffect(() => {
    // Sem ninguém para cruzar não há o que buscar. O mapa anterior pode ficar
    // como está: nada o lê enquanto `trackedIds` estiver vazio.
    if (trackedIds.length === 0) return;

    let cancelled = false;

    // Só as votações que têm voto individual publicado. Pedir as demais seria
    // uma requisição por votação para receber lista vazia garantida.
    const votacoes = votings
      .filter((item) => item.voting.hasIndividualVotes)
      .map((item) => item.voting.id)
      .join(",");
    if (!votacoes) return;

    fetch(
      `/api/votos?deputados=${trackedKey}&votacoes=${encodeURIComponent(votacoes)}`,
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { votes: DeputyVotes }) => {
        if (!cancelled) setCrossRef({ key: trackedKey, votes: body.votes });
      })
      .catch(() => {
        // Falha no cruzamento: encerramos o carregamento sem inventar votos.
        if (!cancelled) setCrossRef({ key: trackedKey, votes: null });
      });

    return () => {
      cancelled = true;
    };
  }, [trackedIds.length, trackedKey, votings]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = useMemo(
    () =>
      filterVotings(votings, {
        topicId,
        topicIds: onlyMine ? preferences?.topics : undefined,
        deputyIds: searched
          ? [searched.id]
          : onlyMine && isPersonal
            ? followed.map((item) => item.externalId)
            : null,
        deputyVotes,
        onlyWithVotes,
      }),
    [
      votings,
      topicId,
      onlyMine,
      preferences?.topics,
      searched,
      isPersonal,
      followed,
      deputyVotes,
      onlyWithVotes,
    ],
  );

  function clearFilters() {
    setTopicId(null);
    setSearched(null);
    setOnlyWithVotes(false);
    setOnlyMine(false);
  }

  const hasFilters =
    topicId !== null || searched !== null || onlyWithVotes || onlyMine;
  const withVotesInFeed = votings.filter(
    (item) => item.voting.hasIndividualVotes,
  ).length;

  return (
    <>
      <SiteHeader
        onOpenSearch={() => setSearchOpen(true)}
        syncLabel={syncLabel}
        showPreferences={isPersonal}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 px-4 py-4 sm:px-7 sm:py-5">
        {latest && <HeroStrip item={latest} syncLabel={syncLabel} />}

        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:items-start">
          <aside className="order-2 grid gap-4 sm:grid-cols-2 xl:order-1 xl:grid-cols-1">
            {isPersonal && (
              <FollowedPanel
                legislators={followed}
                votings={votings}
                deputyVotes={deputyVotes}
                loading={loadingVotes}
              />
            )}
            <CoveragePanel
              stats={coverage}
              coverageEnd={coverageEnd}
              yearTotal={yearTotal}
              yearWithVotes={yearWithVotes}
            />
            <TopicsPanel counts={counts} selected={topicId} onSelect={setTopicId} />
          </aside>

          <Panel padded={false} className="order-1 overflow-hidden xl:order-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle px-5 py-4">
              <h2 className="text-[17px] font-medium leading-tight text-text">
                {onlyMine && isPersonal ? "Seu acompanhamento" : "Votações recentes"}
              </h2>
              <span className="font-mono text-xs text-text-dim">
                {visible.length} de {votings.length}
              </span>

              {isPersonal && (
                <Toggle
                  active={onlyMine}
                  onClick={() => setOnlyMine((value) => !value)}
                  title="Mostrar apenas as votações dos parlamentares que você acompanha, nos seus temas"
                >
                  Só os meus
                </Toggle>
              )}

              <Toggle
                active={onlyWithVotes}
                onClick={() => setOnlyWithVotes((value) => !value)}
                title="Mostrar apenas votações em que a fonte publicou o voto de cada parlamentar"
                count={withVotesInFeed}
              >
                Com voto individual
              </Toggle>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto text-xs text-accent hover:text-accent-hover"
                >
                  limpar filtros
                </button>
              )}
            </div>

            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-border-subtle px-5 py-2.5 xl:hidden">
              <FilterPill active={topicId === null} onClick={() => setTopicId(null)}>
                Todos
              </FilterPill>
              {TOPICS.map((topic) => (
                <FilterPill
                  key={topic.id}
                  active={topicId === topic.id}
                  onClick={() => setTopicId(topicId === topic.id ? null : topic.id)}
                >
                  {topic.label}
                </FilterPill>
              ))}
            </div>

            {searched && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-2/50 px-5 py-2.5 text-[13px]">
                <span className="text-text-dim">
                  {loadingVotes ? "Buscando votos de" : "Votações com registro de"}
                </span>
                <span className="text-text">{searched.name}</span>
                <span className="font-mono text-xs text-text-dim">
                  {deputyCaption(searched.party, searched.uf)}
                </span>
                <button
                  type="button"
                  onClick={() => setSearched(null)}
                  className="ml-auto text-xs text-accent hover:text-accent-hover"
                >
                  remover
                </button>
              </div>
            )}

            {visible.length === 0 ? (
              <EmptyState
                title={
                  loadingVotes
                    ? "Consultando os votos"
                    : "Nenhuma votação corresponde a estes filtros"
                }
                description={
                  loadingVotes
                    ? "O cruzamento é feito votação a votação, porque a fonte não permite consultar por parlamentar."
                    : "Entre as votações carregadas, nenhuma atende à combinação escolhida. Isso não significa que o parlamentar deixou de votar — apenas que não há registro dele nesta janela."
                }
                action={
                  !loadingVotes && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-full border border-border-strong bg-surface-3 px-4 py-1.5 text-sm text-text hover:border-accent hover:text-accent"
                    >
                      Limpar filtros
                    </button>
                  )
                }
              />
            ) : (
              visible.map((item) => (
                <VotingRow
                  key={item.voting.id}
                  item={item}
                  highlighted={highlighted}
                  deputyVotes={deputyVotes}
                />
              ))
            )}
          </Panel>

          <aside className="order-3 grid gap-4 sm:grid-cols-2 xl:order-3 xl:grid-cols-1">
            <AboutPanel onOpenSearch={!isPersonal ? () => setSearchOpen(true) : undefined} />
            <UpdatesPanel items={votings} />
          </aside>
        </div>
      </main>

      <footer className="mt-2 px-4 py-6 sm:px-7">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border-subtle pt-5 text-xs text-text-dim">
          <p>
            Fonte:{" "}
            <a
              href="https://dadosabertos.camara.leg.br/swagger/api.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-border-strong underline-offset-2 hover:decoration-accent"
            >
              Dados Abertos da Câmara dos Deputados
            </a>
            . O Observando não altera registros oficiais.
          </p>
          <p className="flex items-center gap-3">
            <span>
              Sincronizado <span className="font-mono">{syncLabel}</span>
            </span>
            {isPersonal && (
              <Link href="/preferencias" className="text-accent hover:text-accent-hover">
                Minhas preferências
              </Link>
            )}
          </p>
        </div>
      </footer>

      {searchOpen && (
        <SearchModal
          deputies={deputies}
          onClose={() => setSearchOpen(false)}
          onSelect={setSearched}
        />
      )}
    </>
  );
}

function Toggle({
  active,
  onClick,
  title,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={[
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text",
      ].join(" ")}
    >
      {children}
      {count !== undefined && (
        <span className="ml-1.5 font-mono text-text-dim">{count}</span>
      )}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
