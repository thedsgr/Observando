"use client";

import { ErrorState } from "@/components/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <ErrorState
        description="A página não pôde ser montada com os dados disponíveis."
        onRetry={reset}
      />
    </main>
  );
}
