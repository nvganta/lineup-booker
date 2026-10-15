import { LineupCard } from "@/components/lineup-card";
import { ProvenancePanel } from "@/components/provenance-panel";
import { SAMPLE_LINEUP } from "@/lib/sample-lineup";
import Link from "next/link";

export default function SamplePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 space-y-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          ← Back to Lineup Booker
        </Link>
        {" · "}
        Example card for layout review (not from live Qloo data).
      </p>
      <LineupCard lineup={SAMPLE_LINEUP} />
      <ProvenancePanel provenance={SAMPLE_LINEUP.provenance} />
    </main>
  );
}
