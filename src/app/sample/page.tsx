import { LineupCard } from "@/components/lineup-card";
import { getOpeningSampleLineup } from "@/lib/opening-sample-cache";
import { connection } from "next/server";
import { Suspense } from "react";

function SampleSkeleton() {
  return (
    <div
      className="max-w-xl mx-auto rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] min-h-[420px] animate-pulse"
      aria-busy="true"
    />
  );
}

async function SampleLineupCard() {
  await connection();
  const lineup = await getOpeningSampleLineup();
  return <LineupCard lineup={lineup} className="max-w-xl mx-auto" />;
}

export default function SamplePage() {
  return (
    <main className="min-h-full bg-[#faf7f2] py-12 px-6">
      <Suspense fallback={<SampleSkeleton />}>
        <SampleLineupCard />
      </Suspense>
    </main>
  );
}
