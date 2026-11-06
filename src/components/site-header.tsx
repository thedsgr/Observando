"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";

type Props = {
  onOpenSearch: () => void;
  syncLabel: string;
  /** Quem já configurou acompanhamento tem acesso às preferências. */
  showPreferences?: boolean;
};

export function SiteHeader({ onOpenSearch, syncLabel, showPreferences }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size="lg" />
          <span className="hidden text-xs text-text-dim sm:block">
            Câmara dos Deputados
          </span>
        </Link>

        {/* Estado operacional sempre visível: o produto não promete tempo real. */}
        <span
          className="ml-auto hidden items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-muted lg:flex"
          title="Periodicidade de sincronização com a API da Câmara"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ background: "var(--status)" }}
          />
          Sincronizado {syncLabel}
        </span>

        <button
          type="button"
          onClick={onOpenSearch}
          className="ml-auto flex min-w-0 items-center gap-2.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-text-dim transition-colors hover:border-border-strong hover:text-text-muted lg:ml-0"
        >
          <span aria-hidden className="text-base leading-none">⌕</span>
          <span className="truncate">Buscar deputado</span>
          <kbd className="ml-3 hidden rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] sm:block">
            ⌘K
          </kbd>
        </button>

        {showPreferences && (
          <Link
            href="/preferencias"
            className="hidden shrink-0 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text sm:block"
          >
            Preferências
          </Link>
        )}
      </div>
    </header>
  );
}
