"use client";

import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import type { PitchPayload } from "@/lib/agent/types";
import { ArtistPhoto } from "@/components/artist-photo";
import { stripCityFromNeighborhoodLabel } from "@/lib/lineup/neighborhood-display";
import { cn } from "@/lib/utils";
import {
  DraftedBadge,
  Muted,
  POSTER_ARTICLE_CLASS,
  SectionLabel,
  SourceNote,
  TabHeader,
  TabLoading,
  TabSection,
} from "@/components/venue-tab-parts";

type Props = {
  state: VenueInsightsState;
  pitch: PitchPayload;
  cityLabel: string;
  street: string;
  leadWith: string[];
};

export function MarketingView({ state, pitch, cityLabel, street, leadWith }: Props) {
  if (state.status === "idle" || state.status === "loading") {
    return <TabLoading label="Reading Qloo place data…" />;
  }
  const hoods = pitch.neighborhoods.slice(0, 5);
  const places = state.status === "ready" ? state.places : null;
  const copyState = state.status === "ready" ? state.copy : null;
  const copy = copyState?.status === "ready" ? copyState.copy : null;
  const venueStreet = street.trim().toLowerCase();
  const nearAll = (places?.near.spots ?? []).filter(
    (s) => !venueStreet || s.street.trim().toLowerCase() !== venueStreet,
  );
  const spots = [
    ...nearAll.filter((s) => s.eatDrink),
    ...nearAll.filter((s) => !s.eatDrink),
  ].slice(0, 6);

  return (
    <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-tab-panel="marketing">
      <TabHeader title={`Where to reach ${pitch.headliner.name} fans`} />

      <TabSection>
        <SectionLabel>Where to poster</SectionLabel>
        {hoods.length > 0 ? (
          <ol className="list-none flex flex-wrap gap-x-5 gap-y-1" data-hood-row>
            {hoods.map((n) => (
              <li key={n.rank} className="text-[13px] leading-[1.3] whitespace-nowrap">
                <span className="font-heading text-[15px] leading-none text-[#8c4a32] mr-1">{n.rank}</span>
                {stripCityFromNeighborhoodLabel(n.name, cityLabel)}
              </li>
            ))}
          </ol>
        ) : (
          <Muted>No neighbourhood data for this run.</Muted>
        )}
      </TabSection>

      <TabSection>
        <SectionLabel>Flyer spots</SectionLabel>
        {state.status === "error" ? (
          <Muted>Qloo place data didn&apos;t load.</Muted>
        ) : spots.length >= 3 ? (
          <ul className="list-none grid grid-cols-1 sm:grid-cols-3 gap-x-[18px]">
            {spots.map((s) => (
              <li key={s.id} className="py-[5px] border-t border-[#e8dfd6]">
                <p className="font-heading text-[16px] leading-[1.15]">{s.name}</p>
                <p className="text-[12px] leading-[1.35] text-[#5c534d]">
                  {[s.street, s.kinds.slice(0, 2).join(", ").toLowerCase()].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Muted>Too few fan spots near the venue to suggest.</Muted>
        )}
      </TabSection>

      {leadWith.length > 0 && (
        <TabSection>
          <SectionLabel>Lead with</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {leadWith.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#e0d5ca] bg-[#fbf8f3] px-2.5 py-[5px] text-[12px] leading-none"
              >
                {t}
              </span>
            ))}
          </div>
        </TabSection>
      )}

      <TabSection last>
        <SectionLabel>
          Posts
          {copy && <DraftedBadge source={copy.source} />}
        </SectionLabel>
        <div className="flex gap-4 items-start">
          <div className="w-[104px] flex-none overflow-hidden rounded-md border border-[#e0d5ca] bg-[#f7f2eb] pb-2" aria-label="Story preview">
            <ArtistPhoto
              name={pitch.headliner.name}
              imageUrl={pitch.headliner.imageUrl}
              rounded="none"
              className="h-[104px] w-full text-3xl"
            />
            <div className="px-2 pt-[7px]">
              <p className="font-heading text-[15px] leading-none">{pitch.headliner.name}</p>
              {pitch.opener && (
                <p className="text-[9px] leading-[1.3] text-[#5c534d] mt-[3px]">with {pitch.opener.name}</p>
              )}
            </div>
          </div>
          {copy ? (
            <div className="flex flex-1 min-w-0 flex-col gap-[7px]">
              {copy.captions.slice(0, 2).map((c) => (
                <p key={c} className="rounded-[3px] border border-[#e8dfd6] bg-[#fbf8f3] px-2.5 py-1.5 text-[13px] leading-[1.45]">
                  {c}
                </p>
              ))}
            </div>
          ) : copyState?.status === "loading" ? (
            <p className="text-[13px] text-[#8a7f76] italic" aria-busy="true" data-drafting>
              Drafting posts…
            </p>
          ) : (
            <Muted>Drafting didn&apos;t finish, so no posts are shown.</Muted>
          )}
        </div>
        <SourceNote className="mt-3">Qloo heatmap and fan places within 1.5 km.</SourceNote>
      </TabSection>
    </article>
  );
}
