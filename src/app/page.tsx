import { Suspense } from "react";
import { Home } from "@/components/home";
import { FeedSkeleton } from "@/components/states";
import { fetchDeputies, fetchRecentVotings } from "@/lib/db/feed";

/**
 * Tudo vem do banco, que a sincronização preenche a partir dos arquivos
 * anuais da Câmara (ver src/lib/db/feed.ts).
 *
 * `syncedAt` é quando a fonte foi lida; `coverageEnd` é até onde o arquivo
 * vai. São coisas diferentes e a interface mostra as duas (PRD §5.6, §8.3).
 */
async function HomeData() {
  const [feed, deputies] = await Promise.all([
    fetchRecentVotings(),
    fetchDeputies(),
  ]);

  return (
    <Home
      votings={feed.items}
      deputies={deputies}
      syncedAt={feed.syncedAt}
      coverageEnd={feed.coverageEnd}
      yearTotal={feed.yearTotal}
      yearWithVotes={feed.yearWithVotes}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-7">
          <FeedSkeleton />
        </main>
      }
    >
      <HomeData />
    </Suspense>
  );
}
