"use client";

import type { BookingInput } from "@/lib/book/booking-email";
import {
  bookingKey,
  setBookingStatus,
  useBookingStatus,
  type BookingStatus,
} from "@/lib/book/booking-status";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const STEPS: Array<[BookingStatus, string]> = [
  ["new", "Not asked yet"],
  ["sent", "Email sent"],
  ["confirmed", "Confirmed"],
];

function ActRow({
  role,
  name,
  status,
  onStatus,
  onEmail,
}: {
  role: string;
  name: string;
  status: BookingStatus;
  onStatus: (s: BookingStatus) => void;
  onEmail: () => void;
}) {
  return (
    <li
      className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      data-booking-act={role.toLowerCase()}
      data-status={status}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a7f76]">
          {role}
        </p>
        <p className="text-[14px] font-medium text-[#1a1614] truncate">
          {name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label={`Where booking ${name} stands`}
          className="inline-flex rounded-full border border-[#e0d5ca] bg-[#f3ece4]/70 p-0.5"
        >
          {STEPS.map(([value, label]) => {
            const on = status === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onStatus(value)}
                className={cn(
                  "rounded-full px-3 h-7 text-[12px] transition-colors cursor-pointer",
                  on
                    ? value === "confirmed"
                      ? "bg-[#8c4a32] text-[#faf7f2]"
                      : "bg-[#1a1614] text-[#faf7f2]"
                    : "text-[#6b5c52] hover:text-[#1a1614]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onEmail}
          className="rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 h-7 text-[12px] text-[#3d3530] hover:border-[#8c4a32]/40 hover:text-[#8c4a32] transition-colors cursor-pointer"
        >
          Email {name.split(" ")[0]}
        </button>
      </div>
    </li>
  );
}

/**
 * The night from first email to confirmed. Opening an act's email marks it
 * asked; only the owner can mark it confirmed, once the agent says yes.
 */
export function BookingTracker({
  input,
  when,
  onEmail,
}: {
  input: BookingInput;
  when?: string;
  onEmail: (act: "headliner" | "opener") => void;
}) {
  const headKey = bookingKey(input.address, input.headliner);
  const openKey = bookingKey(input.address, input.opener ?? "");
  const head = useBookingStatus(headKey);
  const open = useBookingStatus(openKey);
  const booked =
    head === "confirmed" && (!input.opener || open === "confirmed");
  const title = input.opener
    ? `${input.headliner} with ${input.opener}`
    : input.headliner;

  return (
    <div
      className="border-t border-[#e8dfd6] px-5 py-3.5"
      data-booking-tracker={booked ? "booked" : "open"}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a7f76]">
          Book the night
        </p>
        <p className="text-[11px] text-[#8a7f76]">Saved in this browser</p>
      </div>
      <AnimatePresence initial={false}>
        {booked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div
              className="mt-2.5 flex items-center gap-2.5 rounded-md bg-[#8c4a32] px-3.5 py-2.5 text-[#faf7f2]"
              data-night-booked
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#faf7f2] text-[#8c4a32]">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <p className="text-[13.5px] leading-snug">
                <span className="font-medium">Your night is booked.</span>{" "}
                {title}
                {when ? ` · ${when}` : ""}. Next: the poster and the posts.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ol className="mt-1 list-none divide-y divide-[#efe7dd]">
        <ActRow
          role="Headliner"
          name={input.headliner}
          status={head}
          onStatus={(s) => setBookingStatus(headKey, s)}
          onEmail={() => onEmail("headliner")}
        />
        {input.opener && (
          <ActRow
            role="Opener"
            name={input.opener}
            status={open}
            onStatus={(s) => setBookingStatus(openKey, s)}
            onEmail={() => onEmail("opener")}
          />
        )}
      </ol>
      {!booked && (
        <p className="mt-1.5 text-[11px] leading-snug text-[#8a7f76]">
          Lock the headliner first; they set the date and the fee. Mark an act
          confirmed once their agent says yes.
        </p>
      )}
    </div>
  );
}
