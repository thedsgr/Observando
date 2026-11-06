/* Estados de interface exigidos pelo PRD §6.1 (F14): carregando, vazio, erro
   e indicador de última atualização. Nenhum deles inventa dado: quando falta
   informação, a interface diz que falta. */

export function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando votações…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-b border-border-subtle px-4 py-5 last:border-b-0 sm:px-6"
        >
          <div className="h-3 w-40 animate-pulse rounded-sm bg-surface-3" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded-sm bg-surface-3" />
          <div className="mt-3 h-3 w-full animate-pulse rounded-sm bg-surface-2" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded-sm bg-surface-2" />
          <div className="mt-4 flex gap-2">
            <div className="h-5 w-20 animate-pulse rounded-sm bg-surface-2" />
            <div className="h-5 w-16 animate-pulse rounded-sm bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-16 text-center sm:px-6">
      <p className="text-sm text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="m-4 rounded-sm border border-dashed border-flag/60 bg-surface-2 px-4 py-6 text-center sm:m-6"
    >
      <p className="text-sm text-flag">Não foi possível carregar os dados</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
        {description} Enquanto isso, o Observa não exibe votações parciais nem
        estimadas.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-sm border border-border-strong bg-surface-3 px-3 py-1.5 text-sm text-text hover:border-accent hover:text-accent"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Transparência operacional: quando o dado foi sincronizado, sem prometer tempo real. */
export function LastUpdated({ label }: { label: string }) {
  return (
    <p className="text-xs text-text-dim">
      Última sincronização com a Câmara: <span className="font-mono">{label}</span>.
      Os dados dependem da publicação oficial e não são atualizados em tempo real.
    </p>
  );
}
