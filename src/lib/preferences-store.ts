"use client";

import { EMPTY_PREFERENCES, type Preferences } from "@/lib/preferences";

/**
 * Armazenamento das preferências no navegador.
 *
 * **Temporário.** O destino é o back-end: as preferências precisam viver no
 * servidor para que o envio de e-mail exista, e o esquema já está escrito em
 * `supabase/migrations`. Enquanto o banco não é provisionado, elas ficam aqui
 * para que o fluxo funcione ponta a ponta e possa ser avaliado.
 *
 * Mesmo depois do banco isto continua útil: antes de o canal ser confirmado,
 * as escolhas do onboarding não deveriam ir para o servidor — a confirmação é
 * o momento em que o consentimento existe (PRD §8.4).
 *
 * Implementado como store externo porque é exatamente isso: estado fora do
 * React, que precisa sobreviver a navegação e sincronizar entre componentes.
 */

const KEY = "observa:preferences:v1";

let cache: Preferences | null | undefined;
const listeners = new Set<() => void>();

function read(): Preferences | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...EMPTY_PREFERENCES, ...parsed };
  } catch {
    // Janela anônima, armazenamento bloqueado ou JSON corrompido.
    return null;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Preferences | null {
  if (cache === undefined) cache = read();
  return cache;
}

/** No servidor não há preferências; a interface mostra o estado neutro. */
export function getServerSnapshot(): Preferences | null {
  return null;
}

export function savePreferences(next: Preferences): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sem armazenamento, as preferências valem só para esta sessão.
  }
  for (const listener of listeners) listener();
}

export function clearPreferences(): void {
  cache = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
  for (const listener of listeners) listener();
}

/** `true` só depois da hidratação, para não piscar a tela errada. */
export function subscribeHydration(listener: () => void): () => void {
  return subscribe(listener);
}

export const getHydrated = () => true;
export const getHydratedServer = () => false;
