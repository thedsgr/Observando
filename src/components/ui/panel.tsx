/**
 * Caixa de painel do dashboard modular.
 * A referência usa painéis discretos — raio generoso, borda de 1px em baixo
 * contraste, fundo levemente elevado — em vez de uma lista corrida dividida.
 */
export function Panel({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-panel border border-border-subtle bg-surface",
        padded ? "p-5" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

/**
 * Título de painel. Caixa normal e peso médio, como na referência — rótulos
 * em caixa alta ficam reservados para micro-rótulos dentro do conteúdo.
 */
export function PanelHeader({
  title,
  caption,
  aside,
}: {
  title: string;
  caption?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-medium leading-tight text-text">{title}</h2>
        {caption && <p className="mt-1 text-[13px] leading-snug text-text-dim">{caption}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

/** Linha de dado com rótulo à esquerda, barra ao centro e valor à direita. */
export function MeterRow({
  label,
  value,
  ratio,
  color = "var(--accent)",
  title,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  ratio: number;
  color?: string;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[13px]" title={title}>
      <span className="w-28 shrink-0 truncate text-text-muted">{label}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
        {ratio > 0 && (
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(ratio * 100, 3)}%`, background: color }}
          />
        )}
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-text">{value}</span>
    </div>
  );
}
