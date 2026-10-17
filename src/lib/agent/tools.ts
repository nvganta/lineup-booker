import { geocodeWithRetries } from "@/lib/geocode/nominatim";
import { headlinerDiscoverySignals } from "@/lib/agent/qloo-signals";
import { dedupeTagsByLabel } from "@/lib/agent/tag-labels";
import {
  bookerStepLabel,
  formatStepEvidence,
  type StepNoteContext,
} from "@/lib/agent/step-copy";
import { getAgentRuntime, withoutOpener } from "@/lib/agent/runtime";
import {
  verdictHeadliner,
  verdictNeighborhoods,
  verdictOpener,
  verdictTags,
  verdictVenue,
} from "@/lib/agent/verdicts";
import { attachImageUrl, artistImageFromEntity } from "@/lib/agent/lookup-artist";
import { discoverHeadliners, discoverOpeners, fetchArtistHeatmap, fetchTagHeatmap } from "@/lib/lineup/qloo-calls";
import { selectBenchEntities } from "@/lib/lineup/bench-select";
import { pickHeadlinerForVenue } from "@/lib/lineup/headliner-local-pick";
import { resolveMusicGenreTags } from "@/lib/lineup/genre-tags";
import { resolvePromoteNeighborhoods } from "@/lib/lineup/resolve-neighborhoods";
import {
  openerDiscoveryPopularityMax,
  pickOpener,
} from "@/lib/lineup/opener-select";
import { popularityBandFromConcept, widenPopularityBand } from "@/lib/lineup/tiers";
import { qlooGet } from "@/lib/qloo/client";
import type { QlooEntity, QlooInsightsResponse } from "@/lib/qloo/types";
import type { ProvenanceRequest } from "@/lib/lineup/translate-venue";
import type { VenuePin } from "@/lib/lineup/geography";
import type { AgentSessionState, PitchPayload, ToolVerdict } from "@/lib/agent/types";
type AlternateDto = PitchPayload["alternates"][number];
import { validatePitchPayload } from "@/lib/agent/pitch-validator";
import { runScoutExtrasParallel } from "@/lib/agent/scout-extras";
import { emitSalvagedPitchIfReady } from "@/lib/agent/salvage-pitch";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { hintsFromQlooEntity } from "@/lib/agent/research/qloo-hints";
import {
  assemblePitchWhyLines,
  buildPitchWhyCatalog,
  fallbackMoodLine,
} from "@/lib/agent/pitch-catalog";
import { resolveHomeNeighborhoodLabel } from "@/lib/lineup/venue-home-area";
import { applyArtistBackgroundsToPitch } from "@/lib/agent/research/apply-pitch";
import {
  flushArtistResearch,
  researchNamesForLog,
  researchSourceFootnotes,
  scheduleArtistResearch,
} from "@/lib/agent/research/scheduler";
import type { ArtistResearchInput } from "@/lib/agent/research/types";
import { RESEARCH_TOTAL_MS } from "@/lib/agent/research/types";
import { consumeRefine, type RefineStrategy } from "@/lib/agent/refine";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

const whySchema = z.object({
  why: z.string().min(3).max(240),
});

const WORSHIP_TAG = /worship|gospel|christian|religious|hymn/i;

function rt() {
  const runtime = getAgentRuntime();
  if (!runtime) throw new Error("Agent runtime missing");
  return runtime;
}

function agentLineupRequest(): LineupRequest {
  const runtime = rt();
  if (runtime.lineupRequest) return runtime.lineupRequest;
  return {
    concept: runtime.session.pin?.city ?? "Venue",
    location: "",
    regularsLove: runtime.session.tagLabels.join(", ") || "live music",
  };
}

function agentRunStats() {
  const runtime = rt();
  return {
    elapsedSec: runtime.budget.elapsedSec(),
    qlooLookups: runtime.budget.qlooCalls,
    retries: runtime.retries,
  };
}

function blockRefine(strategy: RefineStrategy) {
  return consumeRefine(rt().session.refineUsed, strategy);
}

function registerArtist(entity: QlooEntity) {
  const runtime = rt();
  runtime.session.knownNames.add(entity.name);
  const id = entity.entity_id ?? entity.id;
  if (id) runtime.session.knownIds.add(id);
}

type StepNoteExtras = Partial<
  Pick<
    StepNoteContext,
    "headlinerCount" | "tagLabels" | "streetHint" | "widenLevel" | "sizing"
  >
>;

function stepStart(
  kind: import("./types").StepKind,
  modelWhy: string,
  noteCtx?: StepNoteExtras,
) {
  const id = crypto.randomUUID();
  const t0 = Date.now();
  const session = rt().session;
  rt().writer.writeStep({
    id,
    kind,
    status: "running",
    label: bookerStepLabel(kind, {
      session,
      modelWhy,
      verdict: { level: "good", reasons: [] },
      ...noteCtx,
    }),
    why: modelWhy,
  });
  return { id, t0 };
}

/** Plain-language note for "How I got here" when promo areas used a fallback. */
function promoSourceNote(session: AgentSessionState): string | undefined {
  const meta = session.neighborhoodResolveMeta;
  if (!meta?.usedTagHeatmap && !meta?.usedRingFallback) return undefined;
  const parts: string[] = [];
  if (meta.usedTagHeatmap) {
    parts.push("some areas come from where fans of these genres cluster");
  }
  if (meta.usedRingFallback) {
    parts.push("some are simply the neighbourhoods closest to the room");
  }
  return `The headliner's own fan map was thin here, so ${parts.join(", and ")}.`;
}

function stepEnd(
  id: string,
  t0: number,
  kind: import("./types").StepKind,
  modelWhy: string,
  verdict: ToolVerdict,
  noteCtx?: StepNoteExtras,
  detailNote?: string,
) {
  const session = rt().session;
  rt().writer.writeStep({
    id,
    kind,
    status: verdict.level === "good" ? "done" : verdict.level,
    label: bookerStepLabel(kind, {
      session,
      modelWhy,
      verdict,
      ...noteCtx,
    }),
    why: modelWhy,
    detail: detailNote ?? (verdict.reasons.join(", ") || undefined),
    evidence: formatStepEvidence(verdict.evidence),
    elapsedSec: Math.max(1, Math.round((Date.now() - t0) / 1000)),
  });
}

/** First address part that isn't just a house number ("2509, Main Street, …" → "Main Street"). */
function streetHintFrom(address: string): string | undefined {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const first = parts.find((p) => !/^\d+[a-z]?$/i.test(p));
  return first?.replace(/^\d+[a-z]?\s+/i, "") || undefined;
}

/** After scout_after_headliner, hand back what it found instead of re-running the same lookups. */
function alreadyScouted() {
  const session = rt().session;
  if (!session.extrasScouted) return null;
  return {
    verdict: { level: "good", reasons: ["already_scouted"] } as ToolVerdict,
    opener: session.openerEntity?.name ?? null,
    neighborhoods: session.neighborhoods.map((n) => n.name),
    crowdLine: session.crowdLine ?? null,
    next: "scout_after_headliner already covered this. Call compose_pitch now.",
  };
}

function registerKnownTagIds(ids: string[]) {
  for (const id of ids) {
    if (id) rt().session.knownTagIds.add(id);
  }
}

function resolveTagIdsForDiscovery(requested: string[]): {
  tagIds: string[];
  unknown: boolean;
} {
  const session = rt().session;
  const known = session.knownTagIds;
  if (known.size === 0) {
    return { tagIds: session.tagIds.length ? session.tagIds : requested, unknown: false };
  }
  const allowed = requested.filter((id) => known.has(id));
  if (allowed.length === 0) {
    return { tagIds: session.tagIds, unknown: true };
  }
  return { tagIds: allowed, unknown: false };
}

function addressForStrategy(
  address: string,
  strategy: "as_typed" | "strip_unit" | "street_only" | "postcode_area",
): string {
  switch (strategy) {
    case "strip_unit":
      return address.replace(/\b(unit|suite|apt|#)\s*[\w-]+/gi, "").trim();
    case "street_only": {
      const m = address.match(/^[\d\s]+[^,]+/);
      return m ? m[0]!.trim() : address;
    }
    case "postcode_area": {
      const pc = address.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i);
      return pc ? pc[0]! : address;
    }
    default:
      return address;
  }
}

function pinFromGeocode(
  hit: NonNullable<Awaited<ReturnType<typeof geocodeWithRetries>>>,
): VenuePin {
  const addr = hit.address;
  return {
    lat: hit.lat,
    lon: hit.lon,
    city: hit.cityForHeatmap,
    state: hit.state,
    country: hit.country,
    county: hit.county,
    stateDistrict: hit.stateDistrict,
    suburb: addr?.suburb ?? addr?.neighbourhood ?? addr?.neighborhood,
    borough: addr?.borough ?? addr?.city_district,
    city_district: addr?.city_district,
  };
}

export function buildAgentTools(): ToolSet {
  return {
    locate_venue: tool({
      description: "Geocode the venue address and set the pin for downstream tools.",
      inputSchema: whySchema.extend({
        address: z.string().min(3),
        strategy: z
          .enum(["as_typed", "strip_unit", "street_only", "postcode_area"])
          .optional(),
      }),
      execute: async ({ address, strategy = "as_typed", why }) => {
        const { id, t0 } = stepStart("venue", why);
        if (strategy !== "as_typed") {
          const blocked = blockRefine("geocode_next_strategy");
          if (blocked) {
            stepEnd(id, t0, "venue", why, blocked);
            return { verdict: blocked, pin: undefined };
          }
        }
        getAgentRuntime()?.budget.useNominatim();
        const query = addressForStrategy(address, strategy);
        const hit = await geocodeWithRetries(query);
        let pin = hit ? pinFromGeocode(hit) : undefined;
        if (pin) {
          const home = await resolveHomeNeighborhoodLabel(pin, hit?.address);
          if (home) pin = { ...pin, homeNeighborhood: home };
        }
        rt().session.pin = pin;
        const verdict = verdictVenue(pin);
        stepEnd(id, t0, "venue", why, verdict, {
          streetHint: streetHintFrom(query) ?? streetHintFrom(hit?.displayName ?? ""),
        });
        return { verdict, pin };
      },
    }),

    room_size_band: tool({
      description: "Derive headliner popularity band from venue concept and optional widen steps.",
      inputSchema: whySchema.extend({
        concept: z.string().min(3),
        // Free models often send "none" or "1"; rejecting that cost a whole
        // model step on every run.
        widen: z
          .union([
            z.literal(0),
            z.literal(1),
            z.literal(2),
            z.enum(["none", "0", "1", "2"]),
          ])
          .optional()
          .describe(
            "0 for the first call; 1 or 2 only to widen after a weak verdict.",
          ),
      }),
      execute: async ({ concept, widen: widenInput, why }) => {
        const widen =
          widenInput === "1"
            ? 1
            : widenInput === "2"
              ? 2
              : typeof widenInput === "number"
                ? widenInput
                : 0;
        const { id, t0 } = stepStart("plan", why, { sizing: true });
        if (widen === 1) {
          const blocked = blockRefine("widen_band_1");
          if (blocked) {
            stepEnd(id, t0, "plan", why, blocked, { sizing: true });
            return { verdict: blocked, band: rt().session.band };
          }
        }
        if (widen === 2) {
          const blocked = blockRefine("widen_band_2");
          if (blocked) {
            stepEnd(id, t0, "plan", why, blocked, { sizing: true });
            return { verdict: blocked, band: rt().session.band };
          }
        }
        const band = widenPopularityBand(popularityBandFromConcept(concept), widen);
        rt().session.band = band;
        rt().session.widenLevel = widen;
        const verdict: ToolVerdict = {
          level: "good",
          reasons: [],
          evidence: {
            min: band.headlinerMin ?? 0,
            max: band.headlinerMax ?? 1,
            widen,
          },
        };
        stepEnd(id, t0, "plan", why, verdict, { sizing: true, widenLevel: widen });
        return { verdict, band };
      },
    }),

    find_music_tags: tool({
      description: "Map regulars/concept phrases to Qloo music genre tag ids.",
      inputSchema: whySchema.extend({
        phrases: z.array(z.string()).min(1).max(6),
        concept: z.string().optional(),
      }),
      execute: async ({ phrases, concept = "", why }) => {
        const { id, t0 } = stepStart("tags", why, { tagLabels: [] });
        const session = rt().session;
        session.tagDiscoveryCalls = (session.tagDiscoveryCalls ?? 0) + 1;
        if (session.tagDiscoveryCalls > 1) {
          const blocked = blockRefine("split_phrases");
          if (blocked) {
            stepEnd(id, t0, "tags", why, blocked);
            return {
              verdict: blocked,
              tagIds: session.tagIds,
              labels: session.tagLabels,
            };
          }
        }
        const requests: ProvenanceRequest[] = [];
        const regulars = phrases.join(", ");
        const resolved = await resolveMusicGenreTags(regulars, concept, requests);
        rt().session.tagIds = resolved.ids;
        rt().session.tagLabels = resolved.labels;
        registerKnownTagIds(resolved.ids);
        const verdict = verdictTags(phrases.length, resolved.ids.length);
        stepEnd(id, t0, "tags", why, verdict, { tagLabels: resolved.labels });
        return { verdict, tagIds: resolved.ids, labels: resolved.labels };
      },
    }),

    adjacent_genres: tool({
      description: "Fetch adjacent music genre tags from Qloo for refinement.",
      inputSchema: whySchema.extend({
        seedArtistId: z.string().optional(),
        seedTagIds: z.array(z.string()).optional(),
        // Models often reuse find_music_tags' field name.
        tagIds: z.array(z.string()).optional(),
      }),
      execute: async ({ seedArtistId, seedTagIds: seedInput, tagIds, why }) => {
        const seedTagIds = seedInput ?? tagIds;
        const { id, t0 } = stepStart("tags", why);
        const openerId = rt().session.openerEntity?.id;
        const refineKey: RefineStrategy =
          seedArtistId && openerId && seedArtistId === openerId
            ? "opener_adjacent_genres"
            : "adjacent_genres";
        const blocked = blockRefine(refineKey);
        if (blocked) {
          stepEnd(id, t0, "tags", why, blocked);
          return { tags: [], verdict: blocked };
        }
        const seeds =
          seedTagIds?.length ? seedTagIds : rt().session.tagIds.slice(0, 2);
        const params: Record<string, string | number | boolean | undefined> = {
          "filter.type": "urn:tag",
          "filter.tag.types": "urn:tag:genre:music",
          take: 8,
        };
        if (seedArtistId) {
          params["signal.interests.entities"] = seedArtistId;
        } else if (seeds.length) {
          params["signal.interests.tags"] = seeds.join(",");
        }
        const requests: ProvenanceRequest[] = [];
        const { data, request } = await qlooGet<QlooInsightsResponse>(
          "/v2/insights",
          params,
        );
        requests.push(request);
        const tags = dedupeTagsByLabel(
          (data.results?.tags ?? data.tags ?? [])
            .map((t) => ({
              id: t.tag_id ?? t.id ?? "",
              name: t.name ?? "",
            }))
            .filter((t) => t.id && !WORSHIP_TAG.test(t.name)),
        );
        if (tags.length) {
          registerKnownTagIds(tags.map((t) => t.id));
          const merged = new Set([...rt().session.tagIds, ...tags.map((t) => t.id)]);
          rt().session.tagIds = [...merged];
          const labelMerge = new Set([
            ...rt().session.tagLabels,
            ...tags.map((t) => t.name),
          ]);
          rt().session.tagLabels = [...labelMerge];
        }
        stepEnd(id, t0, "tags", why, {
          level: tags.length ? "good" : "weak",
          reasons: tags.length ? [] : ["no_adjacent_tags"],
          evidence: { count: tags.length },
        });
        return { tags, verdict: { level: tags.length ? "good" : "weak", reasons: [] } };
      },
    }),

    discover_headliners: tool({
      description: "Discover headliner candidates for tags, band, and pin.",
      inputSchema: whySchema.extend({
        tagIds: z.array(z.string()).min(1),
        operator: z.enum(["union", "intersection"]),
        concept: z.string(),
        address: z.string(),
      }),
      execute: async ({ tagIds, operator, concept, address, why }) => {
        const { id, t0 } = stepStart("headliner", why);
        if (operator === "union") {
          const blocked = blockRefine("union_tags");
          if (blocked) {
            stepEnd(id, t0, "headliner", why, blocked);
            return { verdict: blocked, picked: null, candidates: [] };
          }
        }
        const pin = rt().session.pin;
        const band = rt().session.band ?? popularityBandFromConcept(concept);
        if (!pin) {
          const fail: ToolVerdict = { level: "fail", reasons: ["no_pin"] };
          stepEnd(id, t0, "headliner", why, fail);
          return { verdict: fail, picked: null, candidates: [] };
        }
        const { tagIds: safeTagIds, unknown: unknownTags } =
          resolveTagIdsForDiscovery(tagIds);
        if (unknownTags) {
          const fail: ToolVerdict = {
            level: "fail",
            reasons: ["unknown_tag_ids"],
          };
          stepEnd(id, t0, "headliner", why, fail);
          return { verdict: fail, picked: null, candidates: [] };
        }
        rt().session.tagIds = safeTagIds;
        rt().session.tagOperator = operator;
        const requests: ProvenanceRequest[] = [];
        const signals = headlinerDiscoverySignals(
          pin,
          address,
          safeTagIds,
          rt().session.tagLabels,
        );
        const { artists, qlooReturnedCount } = await discoverHeadliners(
          signals,
          band,
          requests,
        );
        const picked = await pickHeadlinerForVenue(
          artists,
          safeTagIds,
          band,
          pin,
        );
        const enriched: QlooEntity[] = [];
        for (const a of artists.slice(0, 8)) {
          enriched.push(await attachImageUrl(a, requests));
        }
        const pickedEnriched = picked
          ? await attachImageUrl(picked, requests)
          : null;
        if (pickedEnriched) {
          registerArtist(pickedEnriched);
          rt().session.headlinerId = pickedEnriched.entity_id ?? pickedEnriched.id;
          rt().session.headlinerEntity = {
            id: rt().session.headlinerId!,
            name: pickedEnriched.name,
            imageUrl: artistImageFromEntity(pickedEnriched),
            popularity: pickedEnriched.popularity,
          };
          rt().writer.writeArtist({
            id: rt().session.headlinerId!,
            name: pickedEnriched.name,
            imageUrl: artistImageFromEntity(pickedEnriched),
            role: "headliner",
          });
          scheduleArtistResearch(rt().session, {
            id: rt().session.headlinerId!,
            name: pickedEnriched.name,
            hints: hintsFromQlooEntity(pickedEnriched),
          });
        }
        if (picked && pickedEnriched) {
          const openerId = rt().session.openerEntity?.id;
          const benchExclude = [picked];
          if (openerId) {
            const openerEntity = artists.find(
              (a) => (a.entity_id ?? a.id) === openerId,
            );
            if (openerEntity) benchExclude.push(openerEntity);
          }
          const benchPool = await selectBenchEntities(
            artists,
            safeTagIds,
            band,
            picked,
            benchExclude,
            (e) => hintsFromQlooEntity(e),
            4,
          );
          const alternates: AlternateDto[] = [];
          for (const candidate of benchPool) {
            const cid = candidate.entity_id ?? candidate.id;
            if (cid && openerId && cid === openerId) continue;
            const withImage = await attachImageUrl(candidate, requests);
            alternates.push({
              id: withImage.entity_id ?? withImage.id ?? withImage.name,
              name: withImage.name,
              imageUrl: artistImageFromEntity(withImage),
            });
          }
          rt().session.alternateEntities = alternates;
        }
        const verdict = verdictHeadliner(
          picked ?? null,
          artists,
          band,
          safeTagIds,
        );
        stepEnd(id, t0, "headliner", why, verdict, {
          headlinerCount: qlooReturnedCount,
        });
        return {
          verdict,
          picked: pickedEnriched,
          candidates: enriched.map((e) => ({
            id: e.entity_id ?? e.id,
            name: e.name,
            imageUrl: artistImageFromEntity(e),
            popularity: e.popularity,
          })),
          qlooReturnedCount,
        };
      },
    }),

    discover_openers: tool({
      description: "Find opener candidates below headliner popularity with genre overlap.",
      inputSchema: whySchema.extend({
        headlinerId: z.string(),
        tagIds: z.array(z.string()).min(1),
        concept: z.string(),
        address: z.string(),
      }),
      execute: async ({ headlinerId, tagIds, concept, address, why }) => {
        const done = alreadyScouted();
        if (done) return done;
        const { id, t0 } = stepStart("opener", why);
        const session = rt().session;
        session.openerDiscoverCalls = (session.openerDiscoverCalls ?? 0) + 1;
        if (session.openerDiscoverCalls > 1) {
          const blocked = blockRefine("opener_next_batch");
          if (blocked) {
            stepEnd(id, t0, "opener", why, blocked);
            return { verdict: blocked, opener: null };
          }
        }
        const pin = rt().session.pin;
        if (!pin) {
          const fail: ToolVerdict = { level: "fail", reasons: ["no_pin"] };
          stepEnd(id, t0, "opener", why, fail);
          return { verdict: fail, opener: null };
        }
        const resolvedTags = resolveTagIdsForDiscovery(tagIds);
        let safeTagIds = resolvedTags.tagIds;
        if (resolvedTags.unknown || safeTagIds.length === 0) {
          safeTagIds = session.tagIds;
        }
        if (safeTagIds.length === 0) {
          const fail: ToolVerdict = {
            level: "fail",
            reasons: ["unknown_tag_ids"],
          };
          stepEnd(id, t0, "opener", why, fail);
          return { verdict: fail, opener: null };
        }
        const requests: ProvenanceRequest[] = [];
        const headlinerPop = rt().session.headlinerEntity?.popularity ?? 0.9;
        const band =
          rt().session.band ?? popularityBandFromConcept(concept);
        const popMax = openerDiscoveryPopularityMax(headlinerPop, band);
        const signals = headlinerDiscoverySignals(
          pin,
          address,
          safeTagIds,
          rt().session.tagLabels,
        );
        const candidates = await discoverOpeners(
          signals,
          headlinerId,
          popMax,
          requests,
        );
        const headlinerEntity = {
          entity_id: headlinerId,
          id: headlinerId,
          name: rt().session.headlinerEntity?.name ?? "Headliner",
          popularity: headlinerPop,
        } satisfies QlooEntity;
        let pick: Awaited<ReturnType<typeof pickOpener>>;
        try {
          pick = await pickOpener(
            candidates,
            headlinerEntity,
            headlinerId,
            pin,
            safeTagIds,
            {
              requests,
              band,
              localQueryCity: signals.cityForHeatmap,
            },
          );
        } catch (err) {
          console.error("[agent] discover_openers failed", err);
          await emitSalvagedPitchIfReady(
            rt().session,
            agentLineupRequest(),
            rt().writer,
            agentRunStats(),
          );
          const fail: ToolVerdict = { level: "weak", reasons: ["opener_step_error"] };
          stepEnd(id, t0, "opener", why, fail);
          return { verdict: fail, opener: null };
        }
        const opener = pick.opener
          ? await attachImageUrl(pick.opener, requests)
          : null;
        const hasLocal = pick.audit.some((a) => a.kept && a.hasLocalSignal);
        if (opener) {
          registerArtist(opener);
          const openerDto = {
            id: opener.entity_id ?? opener.id ?? opener.name,
            name: opener.name,
            imageUrl: artistImageFromEntity(opener),
          };
          rt().session.openerEntity = openerDto;
          rt().writer.writeArtist({
            id: openerDto.id,
            name: openerDto.name,
            imageUrl: openerDto.imageUrl,
            role: "opener",
          });
          scheduleArtistResearch(rt().session, {
            id: openerDto.id,
            name: openerDto.name,
            hints: hintsFromQlooEntity(opener),
          });
        }
        const verdict = verdictOpener(opener, hasLocal);
        stepEnd(id, t0, "opener", why, verdict);
        return {
          verdict,
          opener,
          audit: pick.audit,
        };
      },
    }),

    check_local_signal: tool({
      description: "Check whether artists have local signal in the venue city.",
      inputSchema: whySchema.extend({
        artistIds: z.array(z.string()).min(1).max(5),
        city: z.string().min(2),
      }),
      execute: async ({ artistIds, city, why }) => {
        const { id, t0 } = stepStart("opener", why);
        const requests: ProvenanceRequest[] = [];
        const results: Array<{ id: string; local: boolean }> = [];
        for (const artistId of artistIds) {
          const { data, request } = await qlooGet<QlooInsightsResponse>(
            "/v2/insights",
            {
              "filter.type": "urn:entity:artist",
              "filter.results.entities": artistId,
              "signal.location.query": city,
              take: 3,
            },
          );
          requests.push(request);
          const local = (data.results?.entities ?? []).some(
            (e) => (e.entity_id ?? e.id) === artistId,
          );
          results.push({ id: artistId, local });
        }
        const anyLocal = results.some((r) => r.local);
        const verdict: ToolVerdict = {
          level: anyLocal ? "good" : "weak",
          reasons: anyLocal ? [] : ["no_local"],
        };
        stepEnd(id, t0, "opener", why, verdict);
        return { results, verdict };
      },
    }),

    map_fan_heat: tool({
      description: "Map fan heat neighbourhoods for an artist or tag fallback.",
      inputSchema: whySchema.extend({
        artistId: z.string().optional(),
        city: z.string(),
        useTagFallback: z.boolean().optional(),
      }),
      execute: async ({ artistId, city, useTagFallback, why }) => {
        const done = alreadyScouted();
        if (done) return done;
        const { id, t0 } = stepStart("neighborhoods", why);
        if (useTagFallback) {
          const blocked = blockRefine("neighborhood_tag_heatmap");
          if (blocked) {
            stepEnd(id, t0, "neighborhoods", why, blocked);
            return { verdict: blocked, neighborhoods: [] };
          }
        }
        const pin = rt().session.pin;
        if (!pin) {
          const fail: ToolVerdict = { level: "fail", reasons: ["no_pin"] };
          stepEnd(id, t0, "neighborhoods", why, fail);
          return { verdict: fail, neighborhoods: [] };
        }
        const requests: ProvenanceRequest[] = [];
        let heatmap;
        if (artistId && !useTagFallback) {
          heatmap = await fetchArtistHeatmap(artistId, city, requests);
        } else {
          heatmap = await fetchTagHeatmap(rt().session.tagIds, city, requests);
        }
        const cacheKey = `agent:nb:${artistId ?? "tags"}:${city}:${pin.lat.toFixed(3)}:${pin.lon.toFixed(3)}`;
        const { neighborhoods } = await resolvePromoteNeighborhoods(
          cacheKey,
          heatmap.grid,
          heatmap.localities,
          pin,
          {
            tagIds: rt().session.tagIds,
            fetchTagHeatmap: () =>
              fetchTagHeatmap(rt().session.tagIds, city, requests),
          },
        );
        const mapped = neighborhoods.map((n) => ({
          rank: n.rank,
          name: n.name,
          lat: n.lat,
          lon: n.lon,
          km: n.lat != null ? undefined : undefined,
          affinity: undefined,
        }));
        rt().session.neighborhoods = mapped;
        for (const n of mapped) rt().session.knownNames.add(n.name);
        rt().writer.writeMap({
          venue: { lat: pin.lat, lon: pin.lon },
          pins: mapped
            .filter((n) => n.lat != null && n.lon != null)
            .map((n) => ({
              rank: n.rank,
              name: n.name,
              lat: n.lat!,
              lon: n.lon!,
            })),
        });
        const verdict = verdictNeighborhoods(mapped.length, false);
        stepEnd(id, t0, "neighborhoods", why, verdict);
        return { verdict, neighborhoods: mapped };
      },
    }),

    crowd_profile: tool({
      description: "Read age-skew demographics for the headliner crowd.",
      inputSchema: whySchema.extend({
        artistId: z.string(),
      }),
      execute: async ({ artistId, why }) => {
        const done = alreadyScouted();
        if (done) return done;
        const { id, t0 } = stepStart("crowd", why);
        const { data, request } = await qlooGet<QlooInsightsResponse>(
          "/v2/insights",
          {
            "filter.type": "urn:demographics",
            "signal.interests.entities": artistId,
            take: 5,
          },
        );
        void request;
        const entities = data.results?.entities ?? [];
        const ageBand = entities.find((e) =>
          /^\d+\s*[-–]\s*\d+/.test(e.name ?? ""),
        );
        if (ageBand?.name) {
          rt().session.crowdLine = `Listeners nearby skew toward ages ${ageBand.name}.`;
        } else {
          rt().session.crowdLine = undefined;
        }
        stepEnd(id, t0, "crowd", why, {
          level: ageBand ? "good" : "weak",
          reasons: ageBand ? [] : ["thin_demographics"],
        });
        return { crowdLine: rt().session.crowdLine, top: ageBand?.name };
      },
    }),

    research_artists: tool({
      description:
        "Public background on headliner/opener (Wikipedia, MusicBrainz). Usually already running in parallel.",
      inputSchema: whySchema.extend({
        artists: z
          .array(
            z.object({
              id: z.string().optional(),
              name: z.string().min(1),
            }),
          )
          .min(1)
          .max(4),
      }),
      execute: async ({ artists, why }) => {
        const session = rt().session;
        const inputs: ArtistResearchInput[] = artists.map((a) => ({
          id: a.id,
          name: a.name,
        }));
        for (const input of inputs) scheduleArtistResearch(session, input);
        const backgrounds = await flushArtistResearch(session, RESEARCH_TOTAL_MS);
        return {
          backgrounds,
          artistCount: Object.keys(backgrounds).length,
          why,
        };
      },
    }),

    scout_after_headliner: tool({
      description:
        "In one parallel pass: local opener, fan-heat neighborhoods, and crowd age skew. Call once after headliner is set.",
      inputSchema: whySchema.extend({
        concept: z.string(),
        address: z.string(),
        tagIds: z.array(z.string()).optional(),
      }),
      execute: async ({ concept, address, tagIds, why }) => {
        const { id, t0 } = stepStart("opener", why);
        const session = rt().session;
        if (!session.headlinerId) {
          const fail: ToolVerdict = { level: "fail", reasons: ["no_headliner"] };
          stepEnd(id, t0, "opener", why, fail);
          return { verdict: fail };
        }
        let ids = tagIds?.length ? tagIds : session.tagIds;
        const resolved = resolveTagIdsForDiscovery(ids);
        if (resolved.unknown || resolved.tagIds.length === 0) {
          ids = session.tagIds;
        } else {
          ids = resolved.tagIds;
        }
        try {
          await runScoutExtrasParallel({ concept, address, tagIds: ids });
        } catch (err) {
          console.error("[agent] scout_after_headliner failed", err);
          await emitSalvagedPitchIfReady(
            session,
            agentLineupRequest(),
            rt().writer,
            agentRunStats(),
          );
        }
        session.extrasScouted = true;
        const verdict: ToolVerdict = {
          level: session.neighborhoods.length >= 2 ? "good" : "weak",
          reasons: [],
          evidence: { neighborhoods: session.neighborhoods.length },
        };
        stepEnd(id, t0, "opener", why, verdict, undefined, promoSourceNote(session));
        return {
          verdict,
          opener: session.openerEntity?.name ?? null,
          neighborhoods: session.neighborhoods.map((n) => n.name),
          crowdLine: session.crowdLine ?? null,
          next: "Call compose_pitch now with this evidence.",
        };
      },
    }),

    compose_pitch: tool({
      description:
        "Final pitch: pick why-lines from catalog slot ids returned in the tool result; moodLine is the only free sentence.",
      inputSchema: whySchema.extend({
        venueLabel: z.string(),
        address: z.string(),
        moodLine: z.string().max(160),
        // Fixed ids in the schema so the model can't guess one that doesn't
        // exist (a free string cost a compose retry on most runs).
        headlinerWhySlot: z
          .enum(["room_and_tags", "genre_match", "local_heat"])
          .describe(
            "room_and_tags: fits the room and the regulars' styles; genre_match: squarely in their styles; local_heat: listeners cluster in the top promo areas.",
          ),
        openerWhySlot: z
          .enum(["local_support", "overlap", "none"])
          .describe(
            "local_support: local act in the same lane; overlap: local crowd overlaps the headliner's fans; none: no opener.",
          ),
        widenRoomNote: z.string().optional(),
      }),
      execute: async ({
        venueLabel,
        address,
        moodLine,
        headlinerWhySlot,
        openerWhySlot,
        widenRoomNote,
        why,
      }) => {
        const session = rt().session;
        const headliner = session.headlinerEntity;
        if (!headliner) {
          const { id, t0 } = stepStart("pitch", why);
          const fail: ToolVerdict = { level: "fail", reasons: ["no_headliner"] };
          stepEnd(id, t0, "pitch", why, fail);
          return { verdict: fail };
        }
        const backgrounds = await flushArtistResearch(session, RESEARCH_TOTAL_MS);
        if (Object.keys(backgrounds).length && !session.artistResearchLogged) {
          session.artistResearchLogged = true;
          const names = researchNamesForLog(session);
          const label =
            names.length === 1
              ? `Read up on ${names[0]}.`
              : names.length === 2
                ? `Read up on ${names[0]} and ${names[1]}.`
                : `Read up on ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}.`;
          rt().writer.writeStep({
            id: crypto.randomUUID(),
            kind: "research",
            status: "done",
            label,
            why: "Wikipedia and MusicBrainz summaries for the poster copy.",
            evidence: Object.values(backgrounds)
              .map((b) => `${b.sourceName}`)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(" · "),
          });
        }

        const catalog = buildPitchWhyCatalog(session);
        // A slot that doesn't apply this run (no areas, no opener) falls back
        // to the always-true line instead of failing the pitch.
        const assembled = assemblePitchWhyLines(
          catalog,
          catalog.headlinerWhy[headlinerWhySlot] ? headlinerWhySlot : "room_and_tags",
          catalog.openerWhy[openerWhySlot]
            ? openerWhySlot
            : session.openerEntity
              ? "local_support"
              : "none",
        );
        if (!assembled) {
          const { id, t0 } = stepStart("pitch", why);
          stepEnd(id, t0, "pitch", why, {
            level: "fail",
            reasons: ["invalid_why_slots"],
          });
          return {
            verdict: { level: "fail", reasons: ["invalid_why_slots"] },
            pitch: null,
            headlinerWhySlots: catalog.headlinerSlotIds,
            openerWhySlots: catalog.openerSlotIds,
            fix: "Pick headlinerWhySlot and openerWhySlot exactly from the lists in this response.",
          };
        }
        const { headlinerWhy, openerWhy } = assembled;

        const { id, t0 } = stepStart("pitch", why);

        let pitch: PitchPayload = {
          venueLabel,
          address,
          moodLine,
          headlinerWhy,
          openerWhy,
          crowdLine: session.crowdLine,
          widenRoomNote:
            widenRoomNote ??
            (session.widenLevel > 0
              ? "Slightly bigger than your room usually books."
              : undefined),
          headliner,
          opener: session.openerEntity ?? null,
          alternates: withoutOpener(session),
          neighborhoods: session.neighborhoods,
          evidenceFootnotes: {
            headliner: headlinerWhy.slice(0, 120),
            opener: openerWhy.slice(0, 120),
            ...researchSourceFootnotes(backgrounds),
          },
        };
        pitch = applyArtistBackgroundsToPitch(pitch, backgrounds);
        const verifiedPlaces = [
          session.pin?.city,
          session.pin?.suburb,
          session.pin?.state,
          ...session.tagLabels,
          ...session.tagLabels.flatMap((l) => l.split(/\s*-\s*/)),
        ];
        let validation = validatePitchPayload(pitch, verifiedPlaces);
        let moodLineReplaced = false;
        if (!validation.ok) {
          // moodLine is the only free sentence; the why-lines come from the
          // catalog. If swapping in the plain mood line passes, keep the
          // model's picks instead of spending a step (or ending in salvage).
          const plain = { ...pitch, moodLine: fallbackMoodLine(session) };
          const second = validatePitchPayload(plain, verifiedPlaces);
          if (second.ok) {
            pitch = plain;
            validation = second;
            moodLineReplaced = true;
          }
        }
        if (!validation.ok) {
          session.pitchValidationAttempts =
            (session.pitchValidationAttempts ?? 0) + 1;
          const canRetry = session.pitchValidationAttempts < 2;
          stepEnd(id, t0, "pitch", why, {
            level: "fail",
            reasons: [validation.reason],
          });
          return {
            verdict: { level: "fail", reasons: [validation.reason] },
            pitch: null,
            unknownNames: validation.unknownNames,
            retryAllowed: canRetry,
            fix:
              validation.reason === "subjective_claims"
                ? `Rewrite using only tool facts: room fit, matched genres, local signal, neighborhood names — no subjective artist praise. Drop: ${validation.unknownNames.join(", ")}.`
                : canRetry
                  ? `Rewrite compose_pitch once without: ${validation.unknownNames.join(", ") || validation.reason}. Use only tool evidence.`
                  : "Rewrite the pitch fields without these names, places, numbers or tool terms. Use only names returned by tools.",
          };
        }
        session.pitch = pitch;
        rt().writer.writePitch(pitch);
        stepEnd(id, t0, "pitch", why, {
          level: moodLineReplaced ? "weak" : "good",
          reasons: moodLineReplaced ? ["mood_line_replaced"] : [],
        });
        return {
          verdict: { level: "good", reasons: [] },
          pitch,
          artistBackgrounds: backgrounds,
          headlinerWhySlots: catalog.headlinerSlotIds,
          openerWhySlots: catalog.openerSlotIds,
        };
      },
    }),
  };
}
