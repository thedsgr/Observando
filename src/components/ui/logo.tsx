/**
 * Marca do Observando: um olho, desenhado em traço, na cor de acento.
 *
 * O olho diz o que o produto faz — acompanhar de perto o que os parlamentares
 * votam — sem símbolo de partido, bandeira ou cor que sugira lado. É SVG
 * inline para herdar `currentColor` e ficar nítido em qualquer tamanho; a
 * mesma figura está em src/app/icon.svg, usada como ícone da aba.
 */
export function EyeIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M2 12c2.6-4.7 6-7 10-7s7.4 2.3 10 7c-2.6 4.7-6 7-10 7s-7.4-2.3-10-7Z" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Olho e nome, juntos. `size` acompanha o tamanho do texto onde aparece. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <EyeIcon className={size === "lg" ? "size-6 text-accent" : "size-5 text-accent"} />
      <span
        className={[
          "font-serif leading-none text-text",
          size === "lg" ? "text-xl" : "text-lg",
        ].join(" ")}
      >
        Observando
      </span>
    </span>
  );
}
