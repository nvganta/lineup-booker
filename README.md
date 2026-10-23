# Lineup Booker

Tell us about your place. We'll tell you who to book, who'll come, what they'll order, and where to find them.

Lineup Booker is an agent for independent venues, built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). You describe your room in three lines (concept, address, what regulars love) and the scout comes back with a night you can book: a headliner sized to the room, a local opener, what to put on special, where to promote, and every Qloo request behind it.

Live: https://lineup-booker.vercel.app

## What you get

**Who to book.** Headliner and opener as cards: photo, hometown, three reasons they fit (rank in the pool for your crowd, draw on Qloo's reach scale, local origin, fan overlap), 30-second previews played in place, and a Book button per act that drafts the enquiry email. Alternates under "More options". Book it at the top opens the night on one page, with a PDF.

**What to sell.** Where the headliner's fans eat and drink, against the city, as three specials with the count in plain words and the deal the agent drafted.

**Where to promote.** The fan heatmap ranked by neighbourhood on a map, flyer spots fans already go to, a poster with a date line you fill in, and captions to copy.

**How we got here.** The same room through a plain model with no Qloo, side by side and checked. Then the trail: room to lineup, stop by stop, with the Qloo requests behind each stop one hover away.

## How it works

The agent runs through the Vercel AI Gateway on free models and can only act through tools backed by Qloo. It cannot invent an artist, a neighbourhood or a number: every pick is a Qloo result and the pitch is validated against those results before it is shown. If the model stalls or is rate limited, the run rotates models, then salvages, then finishes in Quick mode from Qloo data alone.

A night uses about twelve Qloo requests: taste tags from the owner's words, a headliner pool by tag near the pin with a popularity band from the room's capacity, openers the headliner's fans also love, the fan heatmap by grid and locality, audience skew, reach in the city and country, fan overlap between the two acts, and the fans' places against the city's.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Variable | Description |
|----------|-------------|
| `QLOO_API_KEY` | Required for live results (server only) |
| `QLOO_API_BASE` | Defaults to `https://hackathon.api.qloo.com` |
| `AGENT_MODEL` | Primary model id on the Vercel AI Gateway |
| `AGENT_FALLBACK_MODELS` | Comma-separated fallback model ids |
| `AI_GATEWAY_API_KEY` | Gateway access locally; on Vercel, OIDC is automatic. A pulled `VERCEL_OIDC_TOKEN` (`vercel env pull`) also works |
| `SAMPLE_RUNS_JSON` | Saved example runs so the three example rooms open instantly with no Qloo calls (base64 JSON) |

## Scripts

```bash
npm test                      # vitest, unit and UI tests
npm run probe -- --address "2509 Main St, Vancouver, BC" --concept "Natural wine bar, 300 capacity" --regulars "Indie folk"
                              # JSON audit of neighbourhood and opener selection (needs QLOO_API_KEY)
npx tsx scripts/stranger-test.ts [--only berlin]
                              # five rooms the app has never seen, end to end against a local server, timed
```

## Stack

Next.js 16, Vercel AI SDK and AI Gateway, Qloo Insights API, Nominatim, Wikipedia and MusicBrainz for artist facts, Apple's public search for previews, Leaflet.

## License

MIT, Copyright Naveen Sai Ganta.
