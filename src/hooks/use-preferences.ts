"use client";

import { useSyncExternalStore } from "react";
import {
  getHydrated,
  getHydratedServer,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  subscribeHydration,
} from "@/lib/preferences-store";
import type { Preferences } from "@/lib/preferences";

/**
 * Lê as preferências guardadas. Devolve também `hydrated`, que só fica `true`
 * depois que o navegador assume: antes disso não dá para saber se a pessoa já
 * configurou, e mostrar o onboarding por engano seria pior que esperar.
 */
export function usePreferences(): {
  preferences: Preferences | null;
  hydrated: boolean;
} {
  const preferences = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrated,
    getHydratedServer,
  );

  return { preferences, hydrated };
}
