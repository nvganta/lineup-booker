"use client";

import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import { cn } from "@/lib/utils";
import {
  DraftedBadge,
  Muted,
  POSTER_ARTICLE_CLASS,
  SectionLabel,
  SourceNote,
  Swatch,
  TabHeader,
  TabLoading,
  TabSection,
} from "@/components/venue-tab-parts";

type Props = {
  state: VenueInsightsState;
  headlinerName: string;
  cityLabel: string;
};

/** "Late Night Small Plates" reads as a headline; show it in sentence case. */
function sentenceCase(t: string): string {
  const words = t.split(" ");
  if (words.length < 2 || !words.every((w) => /^[A-Z]/.test(w))) return t;
  return [words[0], ...words.slice(1).map((w) => w.toLowerCase())].join(" ");
}

const FAN = "#8c4a32";
const CITY = "#cfc3b6";

export function FoodDealsView({ state, headlinerName, cityLabel }: Props) {
  if (state.status === "idle" || state.status === "loading") {
    return <TabLoading label="Reading Qloo place data…" />;
  }
  const title = `What ${headlinerName} fans eat and drink`;
  if (state.status === "error") {
    return (
      <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")}>
        <TabHeader title={title} />
        <TabSection last>
          <Muted>Qloo place data didn&apos;t load, so nothing is shown.</Muted>
        </TabSection>
      </article>
    );
  }
  const { places, copy: copyState } = state;
  const copy = copyState.status === "ready" ? copyState.copy : null;
  const { food } = places;
  const max = Math.max(1, ...food.rows.flatMap((r) => [r.fans, r.city]));
  const rowByLabel = new Map(food.rows.map((r) => [r.label, r]));
  const city = cityLabel || "City";

  return (
    <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-tab-panel="food">
      <TabHeader title={title} />

      <TabSection>
        <SectionLabel>
          <span className="mr-auto">Fans vs city</span>
          {food.status === "ok" && (
            <span className="flex gap-3">
              <Swatch color={FAN}>Fans</Swatch>
              <Swatch color={CITY}>{city}</Swatch>
            </span>
          )}
        </SectionLabel>
        {food.status === "ok" ? (
          <div className="grid grid-cols-[minmax(0,130px)_1fr_auto] sm:grid-cols-[150px_1fr_auto] gap-x-3 gap-y-[7px] items-center text-[13px] leading-tight">
            {food.rows.map((r) => (
              <div key={r.label} className="contents">
                <span className="truncate">{r.label}</span>
                <span className="flex flex-col gap-[3px]" aria-hidden>
                  <span className="block h-[6px] rounded-[1px]" style={{ background: FAN, width: `${(r.fans / max) * 100}%` }} />
                  <span className="block h-[6px] rounded-[1px]" style={{ background: CITY, width: `${(r.city / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-[#5c534d] whitespace-nowrap">
                  {r.fans} <span className="text-[#a0958b]">vs</span> {r.city}
                </span>
              </div>
            ))}
          </div>
        ) : food.status === "sparse" ? (
          <Muted>Too few tagged places to compare.</Muted>
        ) : (
          <Muted>No restaurant or bar data for {city}.</Muted>
        )}
      </TabSection>

      <TabSection last>
        <SectionLabel>
          Ideas
          {copy && copy.ideas.length > 0 && <DraftedBadge source={copy.source} />}
        </SectionLabel>
        {copy && copy.ideas.length > 0 ? (
          <ol className="list-none">
            {copy.ideas.map((idea) => {
              const row = idea.basis ? rowByLabel.get(idea.basis) : undefined;
              return (
                <li key={idea.title} className="py-[7px] border-t border-[#e8dfd6] first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-heading text-[18px] leading-[1.15]">{sentenceCase(idea.title)}</p>
                    {row && (
                      <span className="text-[12px] tabular-nums text-[#8c4a32] whitespace-nowrap">
                        {row.fans} vs {row.city}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] leading-[1.4] text-[#5c534d] mt-0.5">{idea.body}</p>
                </li>
              );
            })}
          </ol>
        ) : food.status !== "ok" ? (
          <Muted>No ideas without enough food data.</Muted>
        ) : copy ? (
          <Muted>The fans&apos; spots don&apos;t stand out from the city&apos;s, so no ideas.</Muted>
        ) : copyState.status === "loading" ? (
          <p className="text-[13px] text-[#8a7f76] italic" aria-busy="true" data-drafting>
            Drafting ideas…
          </p>
        ) : (
          <Muted>Drafting didn&apos;t finish, so no ideas are shown.</Muted>
        )}
        {food.status === "ok" && (
          <SourceNote className="mt-3">
            {food.fanSample === food.citySample
              ? `Qloo, top ${food.fanSample} restaurants and bars for each.`
              : `Qloo, top ${food.fanSample} restaurants and bars for fans, ${food.citySample} for ${city}.`}
          </SourceNote>
        )}
      </TabSection>
    </article>
  );
}
