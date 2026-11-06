"use client";

import { Dashboard } from "@/components/dashboard";
import { Onboarding } from "@/components/onboarding/onboarding";
import { FeedSkeleton } from "@/components/states";
import { usePreferences } from "@/hooks/use-preferences";
import { isComplete } from "@/lib/preferences";
import type { Deputy, VotingWithContext } from "@/lib/types";

type Props = {
  votings: VotingWithContext[];
  deputies: Deputy[];
  syncedAt: string;
  coverageEnd: string;
  yearTotal: number;
  yearWithVotes: number;
};

/**
 * Porta de entrada do site.
 *
 * Quem nunca configurou cai no onboarding; quem já configurou cai direto no
 * próprio painel. A decisão depende de dado que só existe no navegador, então
 * enquanto não há hidratação mostramos o esqueleto — mostrar o onboarding para
 * quem já configurou seria pior do que esperar um instante.
 */
export function Home(props: Props) {
  const { preferences, hydrated } = usePreferences();

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-7">
        <FeedSkeleton />
      </main>
    );
  }

  if (!preferences || !isComplete(preferences)) {
    return <Onboarding deputies={props.deputies} />;
  }

  return <Dashboard {...props} preferences={preferences} />;
}
