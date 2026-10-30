"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingEmail, BookingInput } from "@/lib/book/booking-email";
import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DraftedBadge, SectionLabel } from "@/components/venue-tab-parts";
import {
  mailtoFor,
  ReachMap,
  useActReach,
  useCopy,
} from "@/components/reach-map";
import { BookingProgress, BriefProgress } from "@/components/booking-progress";
import { BookingTracker } from "@/components/booking-tracker";
import { bookingKey, markEnquirySent } from "@/lib/book/booking-status";
import { EASE_OUT } from "@/lib/motion";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const memo = new Map<string, BookingEmail>();
const HOLD_MS = 800;
// Briefs already shown this visit; reopening one skips the checklist.
const briefsShown = new Set<string>();

function useBookingEmail(input: BookingInput) {
  const key = JSON.stringify(input);
  const [, bump] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (memo.has(key)) return;
    let live = true;
    fetch("/api/book-it", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        memo.set(key, (await r.json()) as BookingEmail);
        if (live) bump((n) => n + 1);
      })
      .catch(() => live && setFailedKey(key));
    return () => {
      live = false;
    };
  }, [key]);
  return {
    email: memo.get(key) ?? null,
    failed: failedKey === key && !memo.has(key),
  };
}

const PANEL = "rounded-md border border-[#e8dfd6] bg-[#fcf9f5] text-[#1a1614]";

function PanelHead({
  label,
  badge,
  onClose,
}: {
  label: React.ReactNode;
  badge?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-[#e0d5ca]">
      <SectionLabel className="mb-0">
        {label}
        {badge}
      </SectionLabel>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-full p-1 text-[#8a7f76] hover:text-[#1a1614] hover:bg-[#f0e8de] transition-colors cursor-pointer"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

/** The drafted enquiry to one act's booking contact. */
export function BookingEmailCard({
  input,
  actLabel,
  mbid,
  onClose,
  className,
}: {
  input: BookingInput;
  actLabel: string;
  /** MusicBrainz id from the act's background, when the card has one. */
  mbid?: string;
  onClose: () => void;
  className?: string;
}) {
  const { email, failed } = useBookingEmail(input);
  const reach = useActReach(actLabel, mbid);
  const [copied, copy] = useCopy();
  // The best address we found goes straight into the To field.
  const to = reach?.emails[0]?.address;
  const statusKey = bookingKey(input.address, actLabel);
  const ready = Boolean((email || failed) && reach);
  // Already looked up (opened before): straight to the email.
  const [working, setWorking] = useState(!ready);
  useEffect(() => {
    if (!ready || !working) return;
    // Let the last tick land before the email replaces the list.
    const t = setTimeout(() => setWorking(false), HOLD_MS);
    return () => clearTimeout(t);
  }, [ready, working]);

  return (
    <article className={cn(PANEL, className)} data-book="email">
      <PanelHead
        label={<>Email to {actLabel}</>}
        badge={!working && email && <DraftedBadge source={email.source} />}
        onClose={onClose}
      />
      <AnimatePresence mode="wait" initial={false}>
        {working ? (
          <motion.div
            key="working"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <BookingProgress
              act={actLabel}
              email={email}
              emailFailed={failed}
              reach={reach}
            />
          </motion.div>
        ) : (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {email ? (
              <div className="px-5 py-3">
                {to && (
                  <p className="mb-1.5 text-[12px] text-[#6b5c52]">
                    To: <span className="text-[#1a1614]">{to}</span>
                  </p>
                )}
                <p className="font-heading text-[16px] leading-snug">
                  {email.subject}
                </p>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.55] text-[#3d3530]">
                  {email.body}
                </p>
                <div className="flex flex-wrap gap-2.5 mt-3.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-[#e0d5ca] text-sm"
                    onClick={() =>
                      copy(
                        "email",
                        `Subject: ${email.subject}\n\n${email.body}`,
                      )
                    }
                  >
                    {copied === "email" ? "Copied" : "Copy email"}
                  </Button>
                  <a
                    href={mailtoFor(to ?? "", email)}
                    onClick={() => markEnquirySent(statusKey)}
                    className="inline-flex items-center rounded-full bg-[#8c4a32] px-4 h-9 text-sm text-[#faf7f2] hover:bg-[#7a4030]"
                  >
                    Open in mail
                  </a>
                </div>
                <p className="mt-3 text-[11px] text-[#8a7f76]">
                  Fill in [date], [offer] and [owner name] before it goes.
                </p>
                {reach ? (
                  <ReachMap
                    onSend={() => markEnquirySent(statusKey)}
                    actLabel={actLabel}
                    input={input}
                    email={email}
                    reach={reach}
                  />
                ) : (
                  <p
                    className="mt-4 border-t border-[#e8dfd6] pt-3 text-[12px] italic text-[#8a7f76]"
                    aria-busy="true"
                  >
                    Finding how to reach {actLabel}…
                  </p>
                )}
              </div>
            ) : (
              <p
                className="px-5 py-6 text-[13px] italic text-[#8a7f76]"
                aria-busy={!failed}
              >
                {failed
                  ? "The email didn't draft this time."
                  : "Drafting the email…"}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/** The night on one page, for staff or print, with the PDF. */
export function NightBriefCard({
  input,
  insights,
  fileSlug,
  when,
  onEmail,
  onClose,
  className,
}: {
  input: BookingInput;
  insights: VenueInsightsState;
  fileSlug: string;
  when?: string;
  onEmail: (act: "headliner" | "opener") => void;
  onClose: () => void;
  className?: string;
}) {
  const copy =
    insights.status === "ready" && insights.copy.status === "ready"
      ? insights.copy.copy
      : null;
  const copyPending =
    insights.status === "loading" ||
    insights.status === "idle" ||
    (insights.status === "ready" && insights.copy.status === "loading");
  const title = input.opener
    ? `${input.headliner} with ${input.opener}`
    : input.headliner;

  const handlePdf = async () => {
    const { buildBriefPdf } = await import("@/lib/book/brief-pdf");
    const bytes = buildBriefPdf({
      title,
      venueLine: `${input.venueLabel} · ${input.address}${when ? ` · ${when}` : ""}`,
      neighborhoods: input.neighborhoods,
      ideas: (copy?.ideas ?? [])
        .slice(0, 3)
        .map((i) => ({ title: i.title, stat: i.basis, body: i.body })),
      posts: (copy?.captions ?? []).slice(0, 2),
      note:
        copy?.source === "template"
          ? "Drafted from the data. Check before sending."
          : "Drafted by the agent. Check before sending.",
    });
    const url = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileSlug}-brief.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const briefKey = JSON.stringify(input);
  // Opened before this visit: straight to the page.
  const [working, setWorking] = useState(() => !briefsShown.has(briefKey));
  const finishWorking = useCallback(() => {
    briefsShown.add(briefKey);
    setWorking(false);
  }, [briefKey]);

  return (
    <article className={cn(PANEL, className)} data-book="brief">
      <PanelHead
        label="The night, on one page"
        badge={!working && copy && <DraftedBadge source={copy.source} />}
        onClose={onClose}
      />
      <AnimatePresence mode="wait" initial={false}>
        {working ? (
          <motion.div
            key="working"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <BriefProgress
              input={input}
              insights={insights}
              onDone={finishWorking}
            />
          </motion.div>
        ) : (
          <motion.div
            key="brief"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 px-5 py-4">
              <div className="min-w-0">
                <p className="font-heading text-[19px] leading-tight">
                  {title}
                </p>
                <p className="text-[12px] text-[#6b5c52] mt-0.5">
                  {input.venueLabel}
                  {when ? ` · ${when}` : ""}
                </p>
                {input.neighborhoods.length > 0 && (
                  <p className="text-[12px] text-[#5c534d] mt-2">
                    Posters: {input.neighborhoods.join(" · ")}
                  </p>
                )}
                {copy ? (
                  <ul className="mt-2.5 space-y-1 list-none">
                    {copy.ideas.slice(0, 3).map((i) => (
                      <li key={i.title} className="text-[13px] leading-snug">
                        <span className="font-medium">{i.title}</span>
                        {i.basis && (
                          <span className="text-[#8c4a32] text-[12px]">
                            {" "}
                            · {i.basis}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    className="mt-2.5 text-[12px] italic text-[#8a7f76]"
                    aria-busy={copyPending}
                  >
                    {copyPending
                      ? "Drafting specials and posts…"
                      : "Specials weren't available."}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 md:w-[220px]">
                <Button
                  type="button"
                  className="rounded-full bg-[#8c4a32] hover:bg-[#7a3f2a] text-white text-sm"
                  onClick={handlePdf}
                  disabled={copyPending}
                >
                  Download brief (PDF)
                </Button>
              </div>
            </div>
            <BookingTracker input={input} when={when} onEmail={onEmail} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
