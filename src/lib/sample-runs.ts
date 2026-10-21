import type { PitchPayload } from "@/lib/agent/types";
import type { PlainResult } from "@/lib/compare/without-qloo";
import type { PitchAnalytics } from "@/lib/lineup/pitch-analytics";

/**
 * Real runs saved from the live app, so the example rooms open instantly and
 * cost no Qloo calls. "Suggest a lineup" still scouts live.
 */
export type SampleRun = {
  savedAt: string;
  pitch: PitchPayload;
  venue: { lat: number; lon: number };
  plain: PlainResult;
  /** What /api/pitch-analytics returned for this pitch, so opening it spends no Qloo calls. */
  analytics: PitchAnalytics;
};

const VANCOUVER: SampleRun = {
  savedAt: "2026-10-20",
  venue: { lat: 49.2626831, lon: -123.101271 },
  pitch: {
    venueLabel: "Natural wine and small plates cafe-bar, 300 capacity",
    address: "2509 Main St, Vancouver, BC",
    moodLine: "An indie folk night sized for your room.",
    headlinerWhy:
      "Jordan Klassen is the right size for this room and plays the indie folk your regulars come in for.",
    openerWhy: "Twin Bandit fits the room's opener slot in the same lane as Jordan Klassen.",
    headliner: {
      id: "2ABCBFD8-4280-4700-8997-17DFF77DDE93",
      name: "Jordan Klassen",
      imageUrl: "https://images.qloo.com/i/2ABCBFD8-4280-4700-8997-17DFF77DDE93-420x-auto.jpg",
      background: {
        line: "Jordan Klassen is a singer-songwriter and producer from Vancouver, British Columbia.",
        sourceName: "Wikipedia",
        sourceUrl: "https://en.wikipedia.org/wiki/Jordan_Klassen",
      },
    },
    opener: {
      id: "F8396012-51EA-4536-A964-463157BAA1A8",
      name: "Twin Bandit",
      imageUrl: "https://images.qloo.com/i/F8396012-51EA-4536-A964-463157BAA1A8-420x-auto.jpg",
      background: {
        line: "Albums include Full Circle.",
        sourceName: "MusicBrainz",
        sourceUrl: "https://musicbrainz.org/artist/f675e07f-6fee-412b-ab64-c2ed0331498e",
      },
    },
    alternates: [
      { id: "E476FDE8-F731-4277-A172-6FC1373BF728", name: "Jon Bryant", imageUrl: "https://images.qloo.com/i/E476FDE8-F731-4277-A172-6FC1373BF728-420x-auto.jpg" },
      { id: "874F42AF-990A-412E-9055-C1B172FE504B", name: "Luca Fogale", imageUrl: "https://images.qloo.com/i/874F42AF-990A-412E-9055-C1B172FE504B-420x-auto.jpg" },
      { id: "80355623-7126-4734-A229-CD0C0023FAD5", name: "Willa", imageUrl: "https://images.qloo.com/i/80355623-7126-4734-A229-CD0C0023FAD5-420x-auto.jpg" },
    ],
    neighborhoods: [
      { rank: 1, name: "Mount Pleasant", lat: 49.2626831, lon: -123.101271 },
      { rank: 2, name: "Strathcona", lat: 49.279554, lon: -123.0899788 },
      { rank: 3, name: "Downtown Eastside", lat: 49.2823992, lon: -123.0994578 },
      { rank: 4, name: "Kensington-Cedar Cottage", lat: 49.2501009, lon: -123.0760714 },
      { rank: 5, name: "Grandview-Woodland", lat: 49.2705588, lon: -123.0679417 },
    ],
    openerSwapQueue: [
      { id: "EAED1463-B64C-4F75-AE6C-0D5814403674", name: "David Vertesi", reason: "fits opener pool for this room (no origin on file)", imageUrl: "https://images.qloo.com/i/EAED1463-B64C-4F75-AE6C-0D5814403674-420x-auto.jpg", popularity: 0.6889552982193998 },
      { id: "D0548A82-C7C3-49FB-8810-8EEE5E7C4D09", name: "Rococode", reason: "origin matches venue", imageUrl: "https://images.qloo.com/i/D0548A82-C7C3-49FB-8810-8EEE5E7C4D09-420x-auto.jpg", popularity: 0.631385617574006 },
      { id: "40301D70-C42A-46BE-A1A1-37CC92815F3B", name: "Louise Burns", reason: "origin matches venue", imageUrl: "https://images.qloo.com/i/40301D70-C42A-46BE-A1A1-37CC92815F3B-420x-auto.jpg", popularity: 0.6624756699368893 },
      { id: "AD6CBB9C-757A-4802-BDC7-2F2E97E25F66", name: "Hannah Epperson", reason: "fits opener pool for this room (no origin on file)", imageUrl: "https://images.qloo.com/i/AD6CBB9C-757A-4802-BDC7-2F2E97E25F66-420x-auto.jpg", popularity: 0.5437515155089816 },
      { id: "CB112AAE-4019-4332-835F-9E8D72920712", name: "Kandle", reason: "fits opener pool for this room (no origin on file)", imageUrl: "https://images.qloo.com/i/CB112AAE-4019-4332-835F-9E8D72920712-420x-auto.jpg", popularity: 0.7885824010905111 },
    ],
    crowdDemographics: {
      age: { "24_and_younger": 0.21, "25_to_29": -0.38, "30_to_34": -0.53, "35_to_44": 0.77, "45_to_54": -0.83, "55_and_older": -0.47 },
      gender: { male: 0.65, female: -0.65 },
    },
    meta: {
      cityQuery: "Vancouver",
      countryQuery: "Canada",
      cityLabel: "Vancouver",
      concept: "Natural wine and small plates cafe-bar, 300 capacity",
      regularsLove: "Indie folk and vinyl nights",
      musicTagIds: ["urn:tag:genre:music:indie_folk"],
      tagLabels: ["Indie - Folk"],
      openerOriginByActId: {
        "D0548A82-C7C3-49FB-8810-8EEE5E7C4D09": true,
        "40301D70-C42A-46BE-A1A1-37CC92815F3B": true,
      },
      openerOriginMatchesCity: false,
      headlinerPopularity: 0.8314590173603602,
      openerPopularity: 0.6231871235803367,
    },
    evidenceFootnotes: { mode: "Quick mode: standard lineup, no AI scout." },
  },
  analytics: {
    acts: [
      { id: "2ABCBFD8-4280-4700-8997-17DFF77DDE93", name: "Jordan Klassen", localAffinity: 0.9977879418308376, nationalAffinity: 0.9902343964710981, whyLine: "83rd percentile for listener reach" },
      { id: "F8396012-51EA-4536-A964-463157BAA1A8", name: "Twin Bandit", localAffinity: 0.9986332638722544, nationalAffinity: 0.9918066270070665, whyLine: "62nd percentile for listener reach" },
      { id: "E476FDE8-F731-4277-A172-6FC1373BF728", name: "Jon Bryant", localAffinity: 0.9987218863013343, nationalAffinity: 0.9966788603681791, whyLine: null },
      { id: "874F42AF-990A-412E-9055-C1B172FE504B", name: "Luca Fogale", localAffinity: 0.9994135307713936, nationalAffinity: 0.9966425656186878, whyLine: null },
      { id: "80355623-7126-4734-A229-CD0C0023FAD5", name: "Willa", localAffinity: 0.9989710913297513, nationalAffinity: 0.9954739730970226, whyLine: null },
    ],
    openerOverlap: { value: 0.7309812497448915, label: "Strongest shared taste: Indie, 0.73", method: "compare" },
    venueTags: [
      { id: "urn:tag:cuisine:qloo:natural_wine_bar", name: "Natural Wine Bar", source: "concept" },
      { id: "urn:tag:amenity:qloo:cafe_bar", name: "Cafe Bar", source: "concept" },
      { id: "urn:tag:style:qloo:indie_folk_rock", name: "Indie Folk Rock", source: "regulars" },
      { id: "urn:tag:activity_type:qloo:vinyl_nights", name: "Vinyl Nights", source: "regulars" },
    ],
    demographics: {
      age: { "24_and_younger": 0.21, "25_to_29": -0.38, "30_to_34": -0.53, "35_to_44": 0.77, "45_to_54": -0.83, "55_and_older": -0.47 },
      gender: { male: 0.65, female: -0.65 },
    },
    crowdLine: "Skews 35–44 · leans male",
    openerShowLocalBadge: false,
  },
  plain: {
    modelId: "nvidia/nemotron-3.5-lightning-free",
    answer: {
      headliner: { name: "The Damn Truth", why: "Indie folk resonance with natural wine ambience and vinyl culture.", local: false },
      opener: { name: "The Salteens", why: "Local favourite aligning with indie folk vinyl night roots.", local: true },
      neighbourhoods: ["Kitsilano", "Mount Pleasant", "Commercial Drive", "Gastown", "Yaletown"],
    },
    headlinerImageUrl: "https://images.qloo.com/i/595EC98A-AAC9-42B6-AE69-87A3B18CA35D-420x-auto.jpg",
    points: [
      { lat: 49.2694099, lon: -123.155267 },
      { lat: 49.2644165, lon: -123.1008859 },
      { lat: 49.2802786, lon: -123.0703598 },
      { lat: 49.2836567, lon: -123.1062358 },
      { lat: 49.2763217, lon: -123.1209558 },
    ],
    marks: {
      headliner: [{ ok: false, text: "Too small to headline · 47th percentile on Qloo" }],
      opener: [],
      neighbourhoods: [null, null, { ok: false, text: "a street" }, null, null],
    },
  },
};

/** Keyed by the sample's address, the one field every example room has unique. */
export const SAMPLE_RUNS: Record<string, SampleRun> = {
  [VANCOUVER.pitch.address]: VANCOUVER,
};
