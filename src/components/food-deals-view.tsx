"use client";

import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import { sellCards, type SellCard } from "@/lib/venue/sell-cards";
import { cn } from "@/lib/utils";
import {
  DraftedBadge,
  Muted,
  POSTER_ARTICLE_CLASS,
  SectionLabel,
  SourceNote,
  TabLoading,
  TabSection,
} from "@/components/venue-tab-parts";
import { useState } from "react";

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

/** Two short bars, fans over city, so the gap reads before the numbers do. */
function PairBars({ fans, city, max }: { fans: number; city: number; max: number }) {
  return (
    <div className="flex flex-col gap-[3px]" aria-hidden>
      <span className="block h-[5px] rounded-[1px]" style={{ background: FAN, width: `${(fans / max) * 100}%` }} />
      <span className="block h-[5px] rounded-[1px]" style={{ background: CITY, width: `${(city / max) * 100}%` }} />
    </div>
  );
}

function Card({ card, max, drafting }: { card: SellCard; max: number; drafting: boolean }) {
  return (
    <li
      className="flex flex-col rounded-md border border-[#e8dfd6] bg-[#fcf9f5] p-4"
      data-sell-card
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-[18px] leading-[1.15]">{card.label}</p>
        <span
          className="shrink-0 rounded-full bg-[#8c4a32] px-2 py-[3px] text-[11px] font-medium leading-none text-[#faf7f2] tabular-nums"
          title={`${card.fans} fan spots vs ${card.city} city spots`}
        >
          {card.lift}
        </span>
      </div>
      <div className="mt-3">
        <PairBars fans={card.fans} city={card.city} max={max} />
      </div>
      <p className="mt-2 mb-3 text-[12px] leading-[1.4] text-[#5c534d]">{card.line}</p>
      <div className="mt-auto pt-3 border-t border-[#e8dfd6]">
        {card.idea ? (
          <>
            <p className="text-[14px] font-medium leading-tight text-[#8c4a32]">
              {sentenceCase(card.idea.title)}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-[#5c534d]">{card.idea.body}</p>
          </>
        ) : drafting ? (
          <p className="text-[12px] italic text-[#8a7f76]" aria-busy="true" data-drafting>
            Drafting a special…
          </p>
        ) : (
          <p className="text-[14px] font-medium leading-tight text-[#8c4a32]">
            {card.fallback}
          </p>
        )}
      </div>
    </li>
  );
}

export function FoodDealsView({ state, headlinerName, cityLabel }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (state.status === "idle" || state.status === "loading") {
    return <TabLoading label="Reading Qloo place data…" />;
  }
  if (state.status === "error") {
    return (
      <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")}>
        <TabSection last>
          <Muted>Qloo place data didn&apos;t load, so nothing is shown.</Muted>
        </TabSection>
      </article>
    );
  }
  const { places, copy: copyState } = state;
  const copy = copyState.status === "ready" ? copyState.copy : null;
  const { food } = places;
  const city = cityLabel || "City";
  const { top, rest } = sellCards({
    rows: food.status === "ok" ? food.rows : [],
    ideas: copy?.ideas ?? [],
    headliner: headlinerName,
    cityLabel: city,
    fanSample: food.fanSample,
    citySample: food.citySample,
  });
  const max = Math.max(1, ...food.rows.flatMap((r) => [r.fans, r.city]));
  const tieIn = copy?.ideas.find((i) => i.basis === "nearby" || !i.basis);

  return (
    <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-tab-panel="food">
      <TabSection>
        <SectionLabel>
          <span className="mr-auto">Put these on special</span>
          {copy && top.some((t) => t.idea) && <DraftedBadge source={copy.source} />}
        </SectionLabel>
        {food.status === "ok" && top.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 list-none">
            {top.map((card) => (
              <Card
                key={card.label}
                card={card}
                max={max}
                drafting={copyState.status === "loading"}
              />
            ))}
          </ul>
        ) : food.status === "sparse" ? (
          <Muted>Too few tagged places to compare.</Muted>
        ) : food.status === "unavailable" ? (
          <Muted>No restaurant or bar data for {city}.</Muted>
        ) : (
          <Muted>The fans&apos; spots don&apos;t stand out from the city&apos;s, so nothing to put on special.</Muted>
        )}
        {tieIn && (
          <div className="mt-3 rounded-md border border-dashed border-[#d4c4b5] px-4 py-3">
            <p className="text-[14px] font-medium leading-tight text-[#8c4a32]">
              {sentenceCase(tieIn.title)}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-[#5c534d]">{tieIn.body}</p>
          </div>
        )}
      </TabSection>

      {rest.length > 0 && (
        <TabSection last>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[12px] text-[#6b5c52] underline underline-offset-[3px] decoration-[#d4c4b5] hover:text-[#8c4a32] cursor-pointer"
            aria-expanded={showAll}
            data-sell-more
          >
            {showAll ? "Hide the rest" : `${rest.length} more ${rest.length === 1 ? "category" : "categories"}`}
          </button>
          {showAll && (
            <div className="mt-3 grid grid-cols-[minmax(0,130px)_1fr_auto] sm:grid-cols-[150px_1fr_auto] gap-x-3 gap-y-[7px] items-center text-[13px] leading-tight">
              {rest.map((r) => (
                <div key={r.label} className="contents">
                  <span className="truncate">{r.label}</span>
                  <PairBars fans={r.fans} city={r.city} max={max} />
                  <span className="text-right tabular-nums text-[#5c534d] whitespace-nowrap">
                    {r.fans} <span className="text-[#a0958b]">vs</span> {r.city}
                  </span>
                </div>
              ))}
            </div>
          )}
          <SourceNote className="mt-3">
            Counts of tagged places among Qloo&apos;s top {food.fanSample} restaurants and bars for {headlinerName} fans, and the top {food.citySample} for {city}.
          </SourceNote>
        </TabSection>
      )}
      {rest.length === 0 && food.status === "ok" && (
        <TabSection last>
          <SourceNote>
            Counts of tagged places among Qloo&apos;s top {food.fanSample} restaurants and bars for {headlinerName} fans, and the top {food.citySample} for {city}.
          </SourceNote>
        </TabSection>
      )}
    </article>
  );
}
