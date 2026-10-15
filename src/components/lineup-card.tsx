import type { LineupResult } from "@/lib/lineup/build-lineup";
import { cn } from "@/lib/utils";

type Props = {
  lineup: LineupResult;
  className?: string;
};

function ArtistBlock({
  role,
  artist,
  featured,
}: {
  role: string;
  artist: LineupResult["headliner"];
  featured?: boolean;
}) {
  return (
    <div className={cn("space-y-2", featured && "md:col-span-2")}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b5c52]">
        {role}
      </p>
      <p className="text-sm text-[#8c4a32] font-medium tracking-wide">
        {artist.tierLabel}
      </p>
      <h3
        className={cn(
          "font-heading leading-none text-[#1a1614]",
          featured ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl",
        )}
      >
        {artist.name}
      </h3>
      {artist.detail && (
        <p className="text-sm text-[#5c534d] leading-relaxed max-w-prose">
          {artist.detail}
        </p>
      )}
    </div>
  );
}

export function LineupCard({ lineup, className }: Props) {
  return (
    <article
      className={cn(
        "relative mx-auto w-full max-w-2xl rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614] shadow-[0_1px_0_rgba(26,22,20,0.06),0_24px_48px_-24px_rgba(26,22,20,0.25)]",
        "px-8 py-10 md:px-12 md:py-14",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#e0d5ca] pb-6 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#8c4a32]">
            {lineup.eventLabel}
          </p>
          <p className="font-heading text-xl mt-1">{lineup.venueLabel}</p>
        </div>
        <p className="text-[#6b5c52] uppercase tracking-widest text-[11px]">
          One night
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <ArtistBlock role="Headliner" artist={lineup.headliner} featured />
        {lineup.opener ? (
          <ArtistBlock role="Opener" artist={lineup.opener} />
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b5c52]">
              Opener
            </p>
            <p className="font-heading text-2xl md:text-3xl text-[#5c534d]">
              No strong local opener found
            </p>
          </div>
        )}
      </div>

      {lineup.alternates.length > 0 && (
        <section className="mt-10 pt-8 border-t border-[#e0d5ca]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b5c52] mb-3">
            Also strong in your crowd profile
          </p>
          <ol className="space-y-2 text-base text-[#1a1614] list-none">
            {lineup.alternates.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="text-sm text-[#8c4a32] shrink-0">
                  {a.tierLabel}
                </span>
                <span className="font-heading">{a.name}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {lineup.neighborhoods.length > 0 && (
        <section className="mt-12 pt-8 border-t border-[#e0d5ca]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b5c52] mb-4">
            Promote in these neighborhoods
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lineup.neighborhoods.map((n) => (
              <li
                key={`${n.rank}-${n.name}`}
                className="border border-[#e8dfd6] bg-[#fcf9f5] px-4 py-3"
              >
                <p className="font-heading text-lg">
                  #{n.rank} {n.name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs text-[#8a7f76] text-center">
        Powered by Qloo taste data.
      </p>
    </article>
  );
}
