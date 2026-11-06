"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchDeputies } from "@/lib/view";
import type { Deputy } from "@/lib/types";

type Props = {
  deputies: Deputy[];
  onClose: () => void;
  onSelect: (deputy: Deputy) => void;
};

/** Pílula de tecla, usada no rodapé e na linha ativa. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-none text-text-muted">
      {children}
    </kbd>
  );
}

/**
 * Busca de deputados em modal central, com navegação por teclado
 * (↑ ↓ Home End Enter Esc) — PRD §9.1 e §9.2.
 *
 * O componente só é montado enquanto o modal está aberto, de modo que cada
 * abertura começa limpa sem reatribuir estado.
 *
 * Na Fase 1 a busca roda sobre o conjunto fictício em memória; na Fase 2 passa
 * a consultar a base sincronizada, mantendo o contrato de `searchDeputies`.
 */
export function SearchModal({ deputies, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const results = useMemo(() => searchDeputies(deputies, query), [deputies, query]);

  // Trava o scroll do documento e devolve o foco ao elemento que abriu.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const active = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function commit(deputy: Deputy) {
    onSelect(deputy);
    onClose();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) =>
          results.length === 0 ? 0 : (index - 1 + results.length) % results.length,
        );
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, results.length - 1));
        break;
      case "Enter": {
        event.preventDefault();
        const deputy = results[activeIndex];
        if (deputy) commit(deputy);
        break;
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] pb-4 sm:px-6"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label="Fechar busca"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-[3px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar deputados federais"
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-panel border border-border-strong bg-surface shadow-2xl shadow-black/70"
      >
        <div className="flex items-center gap-3.5 border-b border-border-subtle px-5 py-4">
          <span className="text-lg leading-none text-text-dim" aria-hidden>
            ⌕
          </span>
          <input
            type="text"
            role="combobox"
            autoFocus
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Deputado federal, partido ou UF"
            className="min-w-0 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-dim"
          />
          <Key>Esc</Key>
        </div>

        {results.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-text-muted">
            Nenhum deputado encontrado para{" "}
            <span className="text-text">“{query}”</span>.
          </p>
        ) : (
          <>
            <p className="px-5 pt-3 pb-1 text-xs text-text-dim">
              {query ? "Resultados" : "Deputados na base"}
            </p>
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Resultados"
              className="min-h-0 flex-1 overflow-y-auto pb-2"
            >
              {results.map((deputy, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={deputy.id}
                    id={`${listboxId}-${deputy.id}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(deputy)}
                    className={[
                      "mx-2 flex cursor-pointer items-center gap-3.5 rounded-md px-3 py-2.5",
                      active ? "bg-surface-3" : "",
                    ].join(" ")}
                  >
                    {/* Emblema de UF, como o emblema de estado da referência. */}
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2 font-mono text-xs text-text-muted"
                    >
                      {deputy.uf ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          "block truncate text-[15px]",
                          active ? "text-text" : "text-text-muted",
                        ].join(" ")}
                      >
                        {deputy.name}
                      </span>
                      <span className="block truncate text-[13px] text-text-dim">
                        Deputado federal
                        {deputy.party ? ` · ${deputy.party}` : " · partido não informado"}
                      </span>
                    </span>
                    {active && <Key>↵</Key>}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-2.5 text-[11px] text-text-dim">
          <span className="flex items-center gap-2">
            <Key>↑</Key>
            <Key>↓</Key>
            <span className="mr-2">navegar</span>
            <Key>↵</Key>
            <span className="mr-2">filtrar feed</span>
            <Key>Esc</Key>
            <span>fechar</span>
          </span>
          <span className="font-mono">{results.length}</span>
        </div>
      </div>
    </div>
  );
}
