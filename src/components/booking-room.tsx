"use client";

import { ArtistPhoto } from "@/components/artist-photo";
import { BookingEmailCard, NightBriefCard } from "@/components/book-it-view";
import { ActRow } from "@/components/booking-tracker";
import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import type { PitchPayload } from "@/lib/agent/types";
import type { BookingInput } from "@/lib/book/booking-email";
import {
  bookingKey,
  setBookingStatus,
  useBookingStatus,
  type BookingStatus,
} from "@/lib/book/booking-status";
import { EASE_OUT, INDICATOR } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type RoomTab = "night" | "headliner" | "opener" | "promote";

const DOT: Record<BookingStatus, string> = {
  new: "bg-[#d4c4b5]",
  sent: "bg-[#c9a593]",
  confirmed: "bg-[#8c4a32]",
};

/** One act's tab: who they are, where the booking stands, and the email. */
function ActTab({
  role,
  act,
  input,
  mbid,
}: {
  role: "Headliner" | "Opener";
  act: { name: string; imageUrl?: string };
  input: BookingInput;
  mbid?: string;
}) {
  const key = bookingKey(input.address, act.name);
  const status = useBookingStatus(key);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-[#e8dfd6] bg-[#fcf9f5] p-3 sm:gap-4 sm:p-4">
        <ArtistPhoto
          name={act.name}
          imageUrl={act.imageUrl}
          rounded="md"
          className="size-12 shrink-0 text-lg sm:size-16 sm:text-xl"
        />
        <ul className="min-w-0 flex-1 list-none">
          <ActRow
            role={role}
            name={act.name}
            status={status}
            onStatus={(s) => setBookingStatus(key, s)}
          />
        </ul>
      </div>
      <BookingEmailCard input={input} actLabel={act.name} mbid={mbid} />
    </div>
  );
}

/**
 * Booking gets its own screen: the night and its tracker, each act's email
 * and contacts, and the poster, one tab each, over the lineup it came from.
 */
export function BookingRoom({
  tab,
  onTab,
  onClose,
  pitch,
  input,
  insights,
  when,
  fileSlug,
  headlinerMbid,
  openerMbid,
  promote,
}: {
  tab: RoomTab | null;
  onTab: (tab: RoomTab) => void;
  onClose: () => void;
  pitch: PitchPayload;
  input: BookingInput;
  insights: VenueInsightsState;
  when?: string;
  fileSlug: string;
  headlinerMbid?: string;
  openerMbid?: string;
  /** The map, flyer spots and poster, as the lineup page renders them. */
  promote: React.ReactNode;
}) {
  const open = tab !== null;
  // Rendered into <body> once in the browser: the lineup sits inside animated,
  // transformed containers that would trap a fixed layer in their own box.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const headStatus = useBookingStatus(
    bookingKey(input.address, pitch.headliner.name),
  );
  const openStatus = useBookingStatus(
    bookingKey(input.address, pitch.opener?.name ?? ""),
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const tabs: Array<{
    id: RoomTab;
    label: string;
    dot?: BookingStatus;
    photo?: string;
  }> = [
    { id: "night", label: "The night" },
    {
      id: "headliner",
      label: pitch.headliner.name,
      dot: headStatus,
      photo: pitch.headliner.imageUrl,
    },
    ...(pitch.opener
      ? [
          {
            id: "opener" as const,
            label: pitch.opener.name,
            dot: openStatus,
            photo: pitch.opener.imageUrl,
          },
        ]
      : []),
    { id: "promote", label: "Promote" },
  ];
  const title = pitch.opener
    ? `${pitch.headliner.name} with ${pitch.opener.name}`
    : pitch.headliner.name;
  const openerInput: BookingInput | null = pitch.opener
    ? {
        ...input,
        headliner: pitch.opener.name,
        opener: null,
        openFor: pitch.headliner.name,
      }
    : null;

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="booking-room"
          role="dialog"
          aria-modal="true"
          aria-label={`Booking ${title}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="fixed inset-0 z-50 flex flex-col bg-[#faf7f2]"
          data-booking-room={tab}
        >
          <header className="shrink-0 border-b border-[#e8dfd6] bg-[#faf7f2]/95 backdrop-blur-sm">
            <div className="mx-auto flex w-full max-w-[72rem] items-start justify-between gap-4 px-4 pt-4 lg:px-8">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a7f76]">
                  Booking the night
                </p>
                <h2 className="mt-0.5 font-display text-[clamp(1.4rem,2.6vw,2rem)] leading-tight text-[#1a1614] truncate">
                  {title}
                </h2>
                <p className="text-[12.5px] text-[#6b5c52] truncate">
                  {pitch.venueLabel}
                  {when ? ` · ${when}` : ""}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Back to the lineup"
                className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 h-9 text-[13px] text-[#5c534d] hover:text-[#1a1614] hover:border-[#8c4a32]/40 transition-colors cursor-pointer"
              >
                <X className="size-4" strokeWidth={2} />
                <span className="max-sm:hidden">Back to the lineup</span>
              </button>
            </div>
            <nav
              aria-label="Booking sections"
              className="mx-auto mt-3 flex w-full max-w-[72rem] gap-1 overflow-x-auto px-4 lg:px-8"
              role="tablist"
            >
              {tabs.map((t) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onTab(t.id)}
                    data-room-tab={t.id}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-1.5 text-[13.5px] transition-colors cursor-pointer",
                      on
                        ? "text-[#1a1614] font-medium"
                        : "text-[#6b5c52] hover:text-[#1a1614]",
                    )}
                  >
                    {t.photo !== undefined && (
                      <ArtistPhoto
                        name={t.label}
                        imageUrl={t.photo}
                        rounded="full"
                        className="size-5 text-[8px]"
                      />
                    )}
                    {t.label}
                    {t.dot && (
                      <span
                        className={cn("size-1.5 rounded-full", DOT[t.dot])}
                        title={
                          t.dot === "confirmed"
                            ? "Confirmed"
                            : t.dot === "sent"
                              ? "Email sent"
                              : "Not asked yet"
                        }
                      />
                    )}
                    {on && (
                      <motion.span
                        layoutId="room-tab"
                        transition={INDICATOR}
                        className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#8c4a32]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-[72rem] px-4 py-6 lg:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  role="tabpanel"
                >
                  {tab === "night" && (
                    <NightBriefCard
                      input={input}
                      insights={insights}
                      fileSlug={fileSlug}
                      when={when}
                      onEmail={(act) => onTab(act)}
                    />
                  )}
                  {tab === "headliner" && (
                    <ActTab
                      role="Headliner"
                      act={pitch.headliner}
                      input={input}
                      mbid={headlinerMbid}
                    />
                  )}
                  {tab === "opener" && pitch.opener && openerInput && (
                    <ActTab
                      role="Opener"
                      act={pitch.opener}
                      input={openerInput}
                      mbid={openerMbid}
                    />
                  )}
                  {tab === "promote" && promote}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
