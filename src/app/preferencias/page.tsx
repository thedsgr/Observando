import { Suspense } from "react";
import { PreferencesEditor } from "@/components/preferences-editor";
import { FeedSkeleton } from "@/components/states";
import { fetchDeputies } from "@/lib/db/feed";

export const metadata = {
  title: "Preferências — Observando",
};

async function EditorData() {
  const deputies = await fetchDeputies();
  return <PreferencesEditor deputies={deputies} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <FeedSkeleton rows={2} />
        </main>
      }
    >
      <EditorData />
    </Suspense>
  );
}
