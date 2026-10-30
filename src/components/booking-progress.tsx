"use client";

import type { BookingEmail, BookingInput } from "@/lib/book/booking-email";
import type { ActReach } from "@/lib/book/find-contact";
import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import { Marker, Shimmer, type StageState } from "@/components/scout-progress";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type WorkStep = {
  id: string;
  title: string;
  state: StageState;
  finding?: string;
  weak?: boolean;
};

/** A checklist of the work behind a panel, in the scout's style. */
function StepList({
  steps,
  ...data
}: { steps: WorkStep[] } & Record<`data-${string}`, boolean>) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <div className="px-5 py-4" aria-busy="true" aria-live="polite" {...data}>
      <div className="h-[3px] overflow-hidden rounded-full bg-[#ece4da]">
        <motion.div
          className="h-full bg-[#8c4a32]"
          initial={false}
          animate={{ width: `${Math.max(6, (done / steps.length) * 100)}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
      </div>
      <ol className="mt-4 list-none space-y-3">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3" data-state={s.state}>
            <span className="pt-px">
              <Marker state={s.state} weak={Boolean(s.weak)} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[14px] leading-5 transition-colors duration-300",
                  s.state === "pending" ? "text-[#a89c92]" : "text-[#1a1614]",
                  s.state === "active" && "font-medium",
                )}
              >
                {s.state === "active" ? <Shimmer>{s.title}</Shimmer> : s.title}
              </p>
              <AnimatePresence initial={false}>
                {s.state === "done" && s.finding && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1 text-[12.5px] leading-snug text-[#6b5c52]">
                      {s.finding}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The server reads MusicBrainz first, then the act's site; one request covers both.
const LISTING_MS = 1200;

function listingFinding(reach: ActReach, act: string): string {
  const labels = reach.links.map((l) => l.label);
  return labels.length
    ? `Found ${labels.slice(0, 3).join(", ")}.`
    : `${act} isn't listed on MusicBrainz yet.`;
}

function siteFinding(reach: ActReach): string {
  const n = reach.emails.length;
  if (n)
    return `${n} ${n === 1 ? "address" : "addresses"} listed on their site.`;
  if (reach.contactPage) return "They take enquiries through a contact form.";
  return reach.links.some((l) => l.label === "Website")
    ? "No booking address on their site."
    : "No website to check.";
}

/** What Book is doing while the email drafts and the contacts are looked up. */
export function BookingProgress({
  act,
  email,
  emailFailed,
  reach,
}: {
  act: string;
  email: BookingEmail | null;
  emailFailed: boolean;
  reach: ActReach | undefined;
}) {
  const [listingRead, setListingRead] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setListingRead(true), LISTING_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <StepList
      data-book-progress
      steps={[
        {
          id: "listing",
          title: `Looking ${act} up on MusicBrainz`,
          state: reach || listingRead ? "done" : "active",
          finding: reach && listingFinding(reach, act),
          weak: reach ? reach.links.length === 0 : false,
        },
        {
          id: "site",
          title: "Checking their website for a booking contact",
          state: reach ? "done" : listingRead ? "active" : "pending",
          finding: reach && siteFinding(reach),
          weak: reach ? reach.emails.length === 0 && !reach.contactPage : false,
        },
        {
          id: "email",
          title: `Writing the email to ${act}`,
          state: email || emailFailed ? "done" : "active",
          finding: email
            ? email.source === "agent"
              ? "Drafted by the agent."
              : "Drafted from the data."
            : emailFailed
              ? "The draft didn't come through."
              : undefined,
          weak: emailFailed,
        },
      ]}
    />
  );
}

// Each step of the brief holds at least this long, so work that finished
// earlier (the page loads the fans' places up front) still reads as steps.
const BRIEF_STEP_MS = 380;
const BRIEF_HOLD_MS = 700;

function listOf(items: string[]): string {
  return items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
    : (items[0] ?? "");
}

/** What Book it is doing while it puts the night on one page. Calls onDone once every step has landed. */
export function BriefProgress({
  input,
  insights,
  onDone,
}: {
  input: BookingInput;
  insights: VenueInsightsState;
  onDone: () => void;
}) {
  const hoods = input.neighborhoods;
  const places = insights.status === "ready" ? insights.places : null;
  const copy = insights.status === "ready" ? insights.copy : null;
  const insightsFailed = insights.status === "error";
  const copySettled =
    insightsFailed || (copy != null && copy.status !== "loading");
  const fanRows =
    places?.food.rows.slice(0, 3).map((r) => r.label.toLowerCase()) ?? [];

  const real: Array<Omit<WorkStep, "state"> & { settled: boolean }> = [
    {
      id: "posters",
      title: "Picking where to put up posters",
      settled: true,
      finding: hoods.length
        ? `${listOf(hoods.slice(0, 2))}${hoods.length > 2 ? ` and ${hoods.length - 2} more` : ""}.`
        : "No neighborhoods stood out this time.",
      weak: hoods.length === 0,
    },
    {
      id: "places",
      title: `Reading where ${input.headliner}'s fans eat and drink`,
      settled: Boolean(places) || insightsFailed,
      finding: fanRows.length
        ? `They lean ${listOf(fanRows)}.`
        : "Qloo had no place data for this city.",
      weak: fanRows.length === 0,
    },
    {
      id: "copy",
      title: "Drafting specials and posts",
      settled: copySettled,
      finding:
        copy?.status === "ready"
          ? `${copy.copy.ideas.slice(0, 3).length} specials and ${copy.copy.captions.slice(0, 2).length} posts, drafted ${copy.copy.source === "agent" ? "by the agent" : "from the data"}.`
          : "Specials weren't available this time.",
      weak: copy?.status !== "ready",
    },
    {
      id: "page",
      title: "Putting the night on one page",
      settled: copySettled,
      finding: "Ready to print or download.",
    },
  ];

  const [shown, setShown] = useState(0);
  const allShown = shown >= real.length;
  const nextSettled = !allShown && real[shown]!.settled;
  useEffect(() => {
    if (allShown) {
      const t = setTimeout(onDone, BRIEF_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (!nextSettled) return;
    const t = setTimeout(() => setShown((n) => n + 1), BRIEF_STEP_MS);
    return () => clearTimeout(t);
  }, [allShown, nextSettled, shown, onDone]);

  return (
    <StepList
      data-brief-progress
      steps={real.map((s, i) => ({
        id: s.id,
        title: s.title,
        finding: s.finding,
        weak: s.weak,
        state: i < shown ? "done" : i === shown ? "active" : "pending",
      }))}
    />
  );
}
