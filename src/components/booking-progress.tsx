"use client";

import type { BookingEmail } from "@/lib/book/booking-email";
import type { ActReach } from "@/lib/book/find-contact";
import { Marker, Shimmer, type StageState } from "@/components/scout-progress";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

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

  const stages: Array<{
    id: string;
    title: string;
    state: StageState;
    finding?: string;
    weak?: boolean;
  }> = [
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
  ];
  const done = stages.filter((s) => s.state === "done").length;

  return (
    <div
      className="px-5 py-4"
      aria-busy="true"
      aria-live="polite"
      data-book-progress
    >
      <div className="h-[3px] overflow-hidden rounded-full bg-[#ece4da]">
        <motion.div
          className="h-full bg-[#8c4a32]"
          initial={false}
          animate={{ width: `${Math.max(6, (done / stages.length) * 100)}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
      </div>
      <ol className="mt-4 list-none space-y-3">
        {stages.map((s) => (
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
                {s.finding && (
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
