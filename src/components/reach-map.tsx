"use client";

import type { BookingEmail, BookingInput } from "@/lib/book/booking-email";
import type { ActReach, ContactEmail } from "@/lib/book/find-contact";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

const reachMemo = new Map<string, ActReach>();
// The sources (MusicBrainz above all) sometimes turn a busy server away, so
// an empty answer gets two more tries before the search fallback shows.
const RETRY_MS = [1500, 3000];

const isEmpty = (r: ActReach) =>
  r.links.length === 0 && r.emails.length === 0 && !r.contactPage;

async function lookUp(name: string, mbid?: string): Promise<ActReach> {
  const q = new URLSearchParams({ name, ...(mbid ? { mbid } : {}) });
  try {
    const r = await fetch(`/api/act-links?${q}`, { cache: "no-store" });
    const j = (r.ok ? await r.json() : {}) as Partial<ActReach>;
    return {
      links: j.links ?? [],
      emails: j.emails ?? [],
      contactPage: j.contactPage,
    };
  } catch {
    return { links: [], emails: [] };
  }
}

/**
 * How to reach an act. A found answer is kept for the visit; an empty one
 * is retried, and isn't kept, so opening the act again asks again.
 */
export function useActReach(name: string, mbid?: string): ActReach | undefined {
  const key = `${name}|${mbid ?? ""}`;
  const [settled, setSettled] = useState<{
    key: string;
    reach: ActReach;
  } | null>(null);
  useEffect(() => {
    if (reachMemo.has(key)) return;
    let live = true;
    (async () => {
      let reach = await lookUp(name, mbid);
      for (const wait of RETRY_MS) {
        if (!isEmpty(reach) || !live) break;
        await new Promise((r) => setTimeout(r, wait));
        reach = await lookUp(name, mbid);
      }
      if (!isEmpty(reach)) reachMemo.set(key, reach);
      if (live) setSettled({ key, reach });
    })();
    return () => {
      live = false;
    };
  }, [key, name, mbid]);
  return (
    reachMemo.get(key) ?? (settled?.key === key ? settled.reach : undefined)
  );
}

export function useCopy(): [string | null, (id: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  return [
    copied,
    (id, text) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(id);
          setTimeout(() => setCopied(null), 1600);
        })
        .catch(() => {});
    },
  ];
}

export function mailtoFor(to: string, email: BookingEmail): string {
  return `mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}

/** The enquiry cut down to a DM: who we are, the ask, who to talk to. */
export function dmText(i: BookingInput): string {
  const room = i.venueLabel.split(",")[0]!.trim();
  const article = /^[aeiou]/i.test(room) ? "an" : "a";
  const styles = i.styleTags.slice(0, 2).join(" and ");
  const ask = i.openFor ? `open for ${i.openFor}` : "play a night";
  return [
    `Hi ${i.headliner}, I run ${article} ${room.charAt(0).toLowerCase()}${room.slice(1)}${i.cityLabel ? ` in ${i.cityLabel}` : ""}${styles ? ` where the regulars love ${styles}` : ""}.`,
    `We'd love to have you ${ask} on [date].`,
    "Who's the best person to talk to about booking?",
    "Thanks, [owner name]",
  ].join(" ");
}

const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 h-7 text-[12px] text-[#3d3530] hover:border-[#8c4a32]/40 hover:text-[#8c4a32] transition-colors cursor-pointer";

const EMAIL_TITLE: Record<ContactEmail["kind"], string> = {
  booking: "Email their booking agent",
  management: "Email their management",
  general: "Email them",
};

function Step({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#1a1614]">{title}</p>
        {detail && (
          <p className="text-[11.5px] text-[#8a7f76] break-words">{detail}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">{children}</div>
    </li>
  );
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={CHIP}>
      {children}
      <ArrowUpRight className="size-3" strokeWidth={2} />
    </a>
  );
}

/** Every way we found to reach the act, best first. Only what's actually listed. */
export function ReachMap({
  actLabel,
  input,
  email,
  reach,
  onSend,
}: {
  actLabel: string;
  input: BookingInput;
  email: BookingEmail;
  reach: ActReach;
  /** An email to the act was opened. */
  onSend?: () => void;
}) {
  const [copied, copy] = useCopy();
  const dm = dmText(input);
  const instagram = reach.links.find((l) => l.label === "Instagram");
  const facebook = reach.links.find((l) => l.label === "Facebook");
  const also = reach.links.filter((l) => l !== instagram && l !== facebook);
  const nothing =
    reach.emails.length === 0 && !reach.contactPage && reach.links.length === 0;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`"${actLabel}" booking contact`)}`;

  return (
    <div
      className="mt-4 border-t border-[#e8dfd6] pt-3"
      data-reach={nothing ? "search" : "found"}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a7f76]">
        How to reach {actLabel}
      </p>
      <ol className="mt-1 list-none divide-y divide-[#efe7dd]">
        {reach.emails.map((e) => (
          <Step
            key={e.address}
            title={EMAIL_TITLE[e.kind]}
            detail={
              <>
                {e.address} · listed on{" "}
                <a
                  href={e.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#8c4a32]"
                >
                  their site
                </a>
              </>
            }
          >
            <a
              href={mailtoFor(e.address, email)}
              onClick={onSend}
              className={cn(
                CHIP,
                "border-[#8c4a32] bg-[#8c4a32] text-[#faf7f2] hover:bg-[#7a4030] hover:text-[#faf7f2]",
              )}
              data-reach-email
            >
              Open in mail
            </a>
          </Step>
        ))}
        {reach.contactPage && (
          <Step
            title="Use the contact page on their site"
            detail="Paste the email above into their form."
          >
            <Out href={reach.contactPage}>Contact page</Out>
          </Step>
        )}
        {instagram && (
          <Step
            title="Send a DM on Instagram"
            detail="Plenty of acts answer DMs before email. Use the short version below."
          >
            <Out href={instagram.url}>Instagram</Out>
          </Step>
        )}
        {facebook && (
          <Step title="Message them on Facebook">
            <Out href={facebook.url}>Facebook</Out>
          </Step>
        )}
        {also.length > 0 && (
          <Step title="Also find them on">
            {also.map((l) => (
              <Out key={l.url} href={l.url}>
                {l.label}
              </Out>
            ))}
          </Step>
        )}
        {nothing && (
          <Step
            title="Search for their booking contact"
            detail={`MusicBrainz doesn't list ${actLabel}'s links yet, so this searches for them.`}
          >
            <Out href={search}>Search</Out>
          </Step>
        )}
      </ol>
      {(instagram || facebook || nothing) && (
        <div className="mt-2 rounded-md bg-[#f3ece4] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a7f76]">
              Short version for DMs
            </p>
            <button
              type="button"
              onClick={() => copy("dm", dm)}
              className={CHIP}
            >
              {copied === "dm" ? "Copied" : "Copy DM"}
            </button>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-[#3d3530]">
            {dm}
          </p>
        </div>
      )}
      <p className="mt-2 text-[11px] text-[#8a7f76]">
        {reach.emails.length > 0 || reach.contactPage
          ? `From MusicBrainz and ${actLabel}'s own site.`
          : "From MusicBrainz."}{" "}
        Nothing is sent from here; it goes from your own inbox and accounts.
      </p>
    </div>
  );
}
