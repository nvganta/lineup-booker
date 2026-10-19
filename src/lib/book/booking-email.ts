import { combinedRowProblems } from "@/lib/venue/drafted-copy";
import type { TasteCountRow } from "@/lib/venue/place-insights";

export type BookingInput = {
  headliner: string;
  opener: string | null;
  venueLabel: string;
  address: string;
  cityLabel: string;
  neighborhoods: string[];
  styleTags: string[];
  rows: TasteCountRow[];
};

export type BookingEmail = { subject: string; body: string; source: "agent" | "template" };

export const PLACEHOLDERS = ["[date]", "[offer]", "[owner name]"] as const;

export function bookingPrompt(i: BookingInput): string {
  return [
    `Venue: ${i.venueLabel}, ${i.address}.`,
    `Music the regulars like: ${i.styleTags.join(", ") || "not given"}.`,
    `Headliner we want: ${i.headliner}.`,
    i.opener ? `Opener we would propose: ${i.opener} (not asked yet).` : "No opener chosen.",
    `Neighbourhoods where ${i.headliner}'s listeners are: ${i.neighborhoods.slice(0, 3).join(", ") || "unknown"}.`,
    "",
    'Write JSON only: {"subject":"","body":""}',
    `A short booking enquiry from the venue owner to ${i.headliner}'s booking agent, under 110 words, sentence-case subject.`,
    "Say who we are and the room, why him in one plain sentence, propose the opener, and ask for availability and terms.",
    "Use the placeholders [date], [offer] and [owner name] exactly as written, and no other bracketed placeholders. Name the venue as given. Do not invent fees, dates, numbers, history, email addresses or phone numbers.",
    "Do not quote percentiles, scores or overlaps. Never say the opener is confirmed or booked. No exclamation marks, no hashtags.",
  ].join("\n");
}

function allowedNumbers(i: BookingInput): Set<string> {
  const nums = new Set<string>();
  for (const t of [i.venueLabel, i.address, i.headliner, i.opener ?? "", ...i.neighborhoods]) {
    for (const m of t.match(/\d+/g) ?? []) nums.add(m);
  }
  return nums;
}

/** Reasons an email can't be shown; empty when it passes. */
export function bookingProblems(subject: string, body: string, i: BookingInput): string[] {
  const text = `${subject}\n${body}`;
  const p: string[] = [];
  if (/\b(confirmed|booked|agreed|locked in)\b/i.test(text)) p.push("claims a confirmation");
  if (/[$£€¥]/.test(text)) p.push("fee");
  if (/percentile|\bscore|overlap|affinity|\bqloo\b/i.test(text)) p.push("quotes a score");
  if (/@|https?:\/\/|www\./i.test(text)) p.push("contact");
  if (/\+?\d[\d\s().-]{7,}\d/.test(text)) p.push("phone");
  if (/!|#\w/.test(text)) p.push("exclamation or hashtag");
  for (const ph of PLACEHOLDERS) if (!body.includes(ph)) p.push(`missing ${ph}`);
  for (const t of text.match(/\[[^\]]*\]/g) ?? []) {
    if (!(PLACEHOLDERS as readonly string[]).includes(t)) p.push(`unknown placeholder ${t}`);
  }
  const allowed = allowedNumbers(i);
  for (const m of text.replace(/\[[^\]]*\]/g, "").match(/\d+/g) ?? []) {
    if (!allowed.has(m)) p.push(`number ${m}`);
  }
  p.push(...combinedRowProblems(text, i.rows));
  return p;
}

export function parseBookingEmail(raw: string, i: BookingInput, onReject?: (r: string) => void): BookingEmail | null {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e <= s) return onReject?.("no json"), null;
  let o: { subject?: unknown; body?: unknown };
  try {
    o = JSON.parse(raw.slice(s, e + 1));
  } catch {
    return onReject?.("bad json"), null;
  }
  const subject = typeof o.subject === "string" ? o.subject.trim().slice(0, 90) : "";
  const body = typeof o.body === "string" ? o.body.trim().slice(0, 1400) : "";
  if (!subject || !body) return onReject?.("empty"), null;
  if (body.split(/\s+/).length > 150) return onReject?.("too long"), null;
  const problems = bookingProblems(subject, body, i);
  if (problems.length > 0) return onReject?.(problems.slice(0, 4).join(", ")), null;
  return { subject, body, source: "agent" };
}

/** Plain fallback straight from the run. */
export function templateBookingEmail(i: BookingInput): BookingEmail {
  const hoods = i.neighborhoods.slice(0, 3);
  const where = hoods.length > 1 ? `${hoods.slice(0, -1).join(", ")} and ${hoods[hoods.length - 1]}` : hoods[0];
  const lines = [
    "Hello,",
    "",
    `I run a ${i.venueLabel.charAt(0).toLowerCase()}${i.venueLabel.slice(1)} at ${i.address}. We'd like to book ${i.headliner} for a night on [date].`,
    where ? `A lot of ${i.headliner}'s listeners live nearby, in ${where}.` : "",
    i.opener ? `We'd propose ${i.opener} to open.` : "",
    "Could you share availability and terms? We can offer [offer].",
    "",
    "Thanks,",
    "[owner name]",
  ];
  return {
    subject: `Booking enquiry: ${i.headliner} at ${i.address.split(",")[0]}`,
    body: lines.filter((l, n) => l !== "" || lines[n - 1] !== "").join("\n").replace(/\n{3,}/g, "\n\n"),
    source: "template",
  };
}
