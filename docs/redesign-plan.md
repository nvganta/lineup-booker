# Lineup Booker: the plan to win

Written October 22, 2026. Submissions close October 30 at 8:45 PM PDT. That's eight days.

## What the judges actually said

The hackathon page is clear about what it wants, and it lines up with your feedback almost exactly.

Four criteria, equal weight as far as the page says. Technological Implementation (how deeply and skillfully we use Qloo). Design (a complete, coherent product, not a proof of concept). Potential Impact (a credible, specific case for a real problem for a real audience). Quality of the Idea (creative, non-obvious, shows we understand the space).

The line that matters most: "If your submission would work the same without Qloo, you're building the wrong thing." We already have the Without Qloo compare. That's our sharpest weapon and right now it's a tiny toggle in the corner.

Two more things change the game. There is no video. Judges open the live link and use it themselves, so a stranger typing their own bar has to get a good result, fast, with zero explanation. And the top three present live on November 5 to Jason Calacanis, Cedric the Entertainer and Alex Elias. Michael Abrams, EVP at Live Nation, is on the judging panel. A venue booking tool is squarely in his world. He will know instantly whether this is real.

So the bar is: a bar owner opens the link, understands it in five seconds, gets a night they'd actually book in under a minute, and a judge can see Qloo doing the work.

## Where we are

The engine is strong. Twelve Qloo calls per run across tags, insights, heatmaps, demographics, compare and places. Receipts for every call. A real agent loop with fallback models and recovery. Eighty-plus tests. Deployed on Vercel. MIT licensed.

The product on top of it is the problem, and your feedback nails it. Every screen answers "what did the system compute" instead of "what should I do." The owner is handed data and asked to do the thinking. That's backwards. The agent did the thinking. The screens should show the conclusion first and keep the evidence one hover away.

Here's the honest diagnosis, screen by screen.

**First open.** You land inside a loaded example with no framing. Nothing says what this is or what to do. The example rooms sit where a "recent" list would normally be, so they read as history, not as invitations.

**Lineup tab.** Two cards with no stated jobs. "One night" is a label nobody asked for. The map has no caption, so it's decoration. "Download poster" screenshots the card, which isn't a poster. The bench shows faces with no way to pick them. The one thing an owner wants to know, "how big is this act and will they fill my room," isn't on the screen.

**Food & deals.** Bars labeled "10 vs 5" are counts of tagged places in two samples. No owner will decode that. The ideas list below repeats the same numbers. Two sections saying one thing badly.

**Marketing.** "Where to poster" is a list of names with no map, while the map lives on the Lineup tab where it doesn't belong. Flyer spots, lead with, posts: four sections, no hierarchy, no visual.

**Data.** Receipts are for judges, and they're good for that, but they're a wall. Charts are buried at the bottom. Nothing shows the path from "your room" to "this headliner."

**New lineup.** Empty form, empty box. No guidance, no example to click.

**Font.** Instrument Serif on top of Geist. It reads as a wine list, not a tool. You don't like it and I think you're right. It's doing "tasteful" when it should be doing "clear."

## The one idea that fixes most of it

Every screen gets one question it answers for the owner, in plain words, with the answer at the top and the proof underneath.

Lineup answers "who do I book." Food & deals answers "what do I put on special." Marketing answers "where do I tell people." Data becomes "how the scout got here" and answers "why should I trust this."

Four questions, four tabs. Rename them to match. The owner never has to translate.

## Screen by screen, what we build

### First run and the empty state

Replace the "Your night shows up here" box with a real first-run panel. One line of what this is: "Tell us about your bar. We'll tell you who to book, who'll come, what they'll order, and where to find them." Under it, three big example room cards, each with a photo of its headliner and one line of result ("Jordan Klassen, indie folk, fills 300"). Click one and the saved run opens instantly. Below that, a quiet three-step strip: describe your room, the scout checks Qloo, you get a night to book.

The sidebar becomes Recent. It only appears once there's something recent. Example rooms live in the first-run panel and as a small "try an example" link under the form. That's the ChatGPT pattern you described: history on the left, starting points in the middle.

New lineup clears the form and shows this same panel. So "New lineup" is never confusing again.

### Lineup, "Who do I book"

One card, not two. Top to bottom:

The headliner. Photo, name, one plain sentence on why ("Indie folk fans within 5 km of you rank them #2 of 9 acts that fit a 300-cap room"). Then the thing that's missing today, a draw line: how big they are on Qloo's scale, turned into words an owner uses. "Mid-size draw, fills 300" or "Rising, fills 150, cheap to book." We don't have fee data, so we never show a dollar figure. We show the tier and what it means for the room, honestly labeled as an estimate.

The opener. Same treatment, smaller, with the Local badge when it's real.

Other options. The bench becomes a row of three or four alternate acts, each clickable, each with its own one-line reason and a "use as headliner" or "use as opener" action. Swap is no longer one button pointing at one name.

Who'll come. The crowd line becomes a small visual: age skew as a tiny bar, gender lean as a single chip. Hover for the number.

One row of actions: Book it (primary), Compare without Qloo. That's it. Download poster leaves this tab.

The map and the neighborhoods leave this tab too. They're a marketing question.

### Food & deals, "What do I put on special"

Three cards, not a chart. Each is a dish or drink category with a lift number the owner can read: "Late night, 2x" with the line "fans of Jordan Klassen go to late-night spots twice as often as Vancouver overall." Under it the deal idea the agent drafted. A visual on each card, a simple lift arc or a pair of dots, so it reads without the number.

Below the three, a fold: "more categories" shows the rest as the current compact list, for owners who want it.

Same data, one story: the fans over-index here, so put it on special that night.

### Marketing, "Where do I tell people"

The map moves here and becomes the hero. Venue pin, five neighborhood pins, ranked. Click a pin and the card beside it shows the neighborhood and its affinity in words ("strongest fan pocket, 2.1 km away"). Flyer spots appear as small pins too, with the names in a list beside the map.

Under the map: the poster. A real one. Headliner name big, opener, venue, a date line to fill in, in the venue's colors. "Download poster" lives here and downloads this. Beside it the two drafted captions with a copy button each, and the story-size preview.

"Where to poster" and "Flyer spots" collapse into the map. "Lead with" becomes the caption chips. Four sections become two.

### Data, "How the scout got here"

This is the interactive piece you're asking for and it's the one judges will screenshot.

A vertical trail, top to bottom, of what the scout did, in owner words. Your room → 3 taste tags → 12 indie folk acts near you → 9 fit the room → Jordan Klassen picked #2 → 5 neighborhoods from the fan heatmap → crowd skews 35 to 44. Each node is a card with a number and a plain label. Hover or tap and it expands to show the exact Qloo request behind it, the parameters, the result count, live or cached. That's the current receipts data, just arranged as a path instead of a list.

The Without Qloo compare moves up here as a side-by-side at the top: what a plain LLM guessed, what Qloo found, with the checks and crosses we already compute. A judge sees in one glance that the headliner without Qloo wasn't even from the right city.

Local vs national chart and opener overlap stay, at the bottom, as "the numbers" for anyone who wants them.

### Font and feel

Drop Instrument Serif. Try three directions, screenshot each, pick in ten minutes. One, all-sans with Geist at heavier weights for headings, the cleanest. Two, a sturdier serif like Fraunces or Newsreader for headlines only, keeps some warmth. Three, a grotesk like Inter Tight or Instrument Sans with tight tracking for a more "tool" feel. My pick is one or three. The warmth should come from the photos and the copy, not the typeface.

Keep the cream palette and the rust accent. They're good and they're ours.

## What's missing for the judges

**A credible impact case, said out loud.** Nowhere does the app say who it's for or why. Add two lines to the first-run panel and to How it works: independent venues book on gut and group chats, and a wrong night costs a week of bar revenue. That's the "real problem for a real audience" sentence the criteria ask for.

**Qloo made visible without being loud.** Right now you can only see Qloo's role if you open Data. The redesign puts "12 Qloo lookups" and the Without Qloo compare where a judge trips over them.

**Strangers must succeed.** Judges will type their own bar in their own city. We need to run five fresh addresses in five cities end to end, time them, and fix whatever stalls. The free fallback model chain is a risk here. If a run takes over ninety seconds or fails, that's the demo. Quick mode exists; it should kick in on its own when the scout is slow.

**Submission hygiene.** The Devpost description written to the four criteria. README that matches the new product. LICENSE visible in the repo's About section (it's MIT, check it shows). Live URL working on a cold load with no key in the browser.

**Mobile.** Judges open links on phones. A pass on the new screens at 375px.

## The order

| Days | What lands |
|------|------------|
| 1 to 2 | Font decision. First-run panel. Sidebar becomes Recent. Tab names. Lineup tab rebuilt as one card with draw line and clickable alternates. Map out of Lineup. |
| 3 | Food & deals as three lift cards. Marketing with the map as hero, the real poster, captions. |
| 4 | Data as the trail with hover-to-receipt. Compare moved up as side-by-side. |
| 5 | Stranger test: five fresh cities end to end. Fix stalls, errors, timing. Auto quick mode. Mobile pass. |
| 6 | Devpost writeup, README, repo check, deploy, cold-load test. |
| 7 to 8 | Buffer. Dry run as a judge. Polish whatever's ugly. Rehearse the two-minute pitch in case we're top three. |

Each day is its own commit and its own look in the browser before moving on. One by one, like you said.

## What I'd cut

The "Saved run" badge, the "One night" label, the compact poster CSS hacks, the screenshot-as-poster, the one-name swap button, the separate "Ideas" list under the food bars. All of it either confuses the owner or duplicates something.

## Open questions for you

Which font direction, once you see the three. Whether the draw line ("fills 300") feels honest enough to ship, since it's a tier read, not a ticket count. And whether you want the Recent sidebar at all for the hackathon, or just the first-run panel and the form. Fewer surfaces, fewer places to look confused.
