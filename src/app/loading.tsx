import { FeedSkeleton } from "@/components/states";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <FeedSkeleton />
    </main>
  );
}
