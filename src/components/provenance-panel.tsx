import type { LineupResult } from "@/lib/lineup/build-lineup";

type Props = {
  provenance: LineupResult["provenance"];
};

export function ProvenancePanel({ provenance }: Props) {
  return (
    <aside className="max-w-2xl mx-auto mt-10">
      <details className="group">
        <summary className="cursor-pointer text-muted-foreground text-xs uppercase tracking-widest list-none">
          View API requests
        </summary>
        <ul className="mt-3 space-y-2 font-mono text-xs text-muted-foreground bg-muted/50 rounded-lg p-4 overflow-x-auto">
          {provenance.requests.map((r, i) => (
            <li key={i}>
              {r.method} {r.path}?{r.query}
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
