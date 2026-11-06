const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const DATE_ONLY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const TIME_ONLY = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso)).replace(",", " às");
}

/** Data curta para a calha do feed, ex.: "03 de nov.". */
export function formatDate(iso: string): string {
  return DATE_ONLY.format(new Date(iso)).replace(" de ", " ");
}

export function formatTime(iso: string): string {
  return TIME_ONLY.format(new Date(iso));
}

export function deputyCaption(party: string | null, uf: string | null): string {
  // A fonte pode não informar partido ou UF; o produto não preenche a lacuna.
  if (party && uf) return `${party} · ${uf}`;
  if (party) return party;
  if (uf) return uf;
  return "Partido/UF não informados";
}
