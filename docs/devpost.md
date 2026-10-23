# Lineup Booker

**Tell us about your place. We'll tell you who to book, who'll come, what they'll order, and where to find them.**

Live: https://lineup-booker.vercel.app
Code: https://github.com/nvganta/lineup-booker (MIT)

## The problem

Independent venues book live music on gut and group chats. A bar owner knows their room and their regulars, but not which acts those regulars would actually turn up for, who should open, or which streets to poster. A wrong night costs a week of bar revenue. Booking agents and promoters have this data. A 120-seat wine bar does not.

## What it does

You type three lines: what your place is, its address, and what your regulars love. The scout, an agent with Qloo's taste graph as its only source of truth, comes back with a night you can book.

Who to book. A headliner sized to your room, with a plain reason ("#2 of 9 acts in the pool for indie folk fans near Vancouver"), a draw read from Qloo's popularity scale ("Big draw, 83rd percentile for listener reach, likely fills a 300-cap room"), and a local opener whose fans overlap with the headliner's. Every act plays 30-second previews in place, so you hear it next to the reason it fits. Alternates sit under "More options". Each act has its own Book button that drafts the enquiry email to that act, because that is how booking actually works, one conversation per act.

What to sell. Qloo's place data for the headliner's fans against the city's, turned into three specials: "10 of Jordan Klassen fans' top 15 spots are open late. 5 of Vancouver's top 15 do." Under each, the deal the agent drafted for that night.

Where to promote. The fan heatmap for the headliner, ranked by neighbourhood within 5 km, on a map. Flyer spots the fans already go to within 1.5 km. A poster, built from the lineup with a date line you fill in, ready to download. Captions, ready to copy.

How we got here. The same room through a plain model with no Qloo, side by side with the Qloo answer, checked line by line (the plain model's headliner was from the wrong city). Then the trail: room to lineup, stop by stop, with the exact Qloo request behind every stop one hover away.

## Why it is Qloo-powered, not LLM-powered

The agent cannot name an artist, a neighbourhood or a number on its own. Every pick comes from a Qloo call, and the code validates the pitch against what Qloo returned before it is shown. If the model stalls, the run finishes from Qloo data alone. That is the design: cultural intelligence is the engine, the model is the writer.

A single night uses around twelve Qloo requests across six endpoints:

Tags: the owner's words become Qloo taste tags (`/v2/tags`, semantic search).
Headliner pool: artists by tag near the venue pin, with a popularity band derived from the room's capacity (`/v2/insights`, `urn:entity:artist`, `signal.location`, `filter.popularity`).
Opener: artists the headliner's fans also love, within the same tags, below the headliner in reach (`signal.interests.entities` + `signal.interests.tags`, intersection).
Neighbourhoods: the headliner's fan heatmap, on a grid and by locality boundary, filtered to the venue's city and 5 km (`urn:heatmap`, `output.heatmap.boundary`).
Crowd: audience skew for the headliner's fans in the city (`urn:demographics`).
Reach and overlap: the acts' affinity in the city and the country, and fan taste overlap between headliner and opener (`filter.results.entities`, `/v2/analysis/compare`).
Food and promotion: the fans' top restaurants and bars against the city's, and fan places near the venue (`urn:entity:place`, `filter.location`).

The receipts are in the app. Every request, every parameter, every result count, live or cached.

## Who it is for

Owners and bookers of rooms between 80 and 400 seats. Bars with a stage, cafes with a Friday set, breweries with a back room. The people who book one night at a time and have never had an agent's data.

## Built with

Next.js 16, Vercel AI SDK with the Vercel AI Gateway (free models, rotating on stall or rate limit, with a code-only Quick mode as the floor), Qloo Insights API, Nominatim for geocoding, Wikipedia and MusicBrainz for artist facts, Apple's public search for previews, Leaflet for maps.

## Try it

Open the live link, click one of the three example rooms, or type your own bar. Then scroll. The trail at the bottom shows you everything Qloo did.
