import {
  getResearchFetch,
  RESEARCH_USER_AGENT,
} from "@/lib/agent/research/fetch";
import type { ActLink } from "@/lib/agent/research/musicbrainz";

export type ContactEmail = {
  address: string;
  /** What the address is for, from its name or the words around it. */
  kind: "booking" | "management" | "general";
  /** The page it was printed on. */
  source: string;
};

export type ActContacts = {
  emails: ContactEmail[];
  /** A contact or booking page on the act's own site. */
  contactPage?: string;
  /** Profiles the act's own homepage links to. */
  socials?: ActLink[];
  /** The website has lapsed into a domain-for-sale page. */
  parked?: boolean;
};

/** Everything /api/act-links returns about reaching one act. */
export type ActReach = { links: ActLink[] } & Omit<
  ActContacts,
  "parked" | "socials"
>;

const SOCIAL_HOSTS: Array<[RegExp, string, RegExp]> = [
  // host, label, paths that are a share button or a single post, not the profile
  [
    /^(www\.)?instagram\.com$/,
    "Instagram",
    /^\/(p|reel|reels|explore|stories|share|accounts)\b/,
  ],
  [
    /^(www\.|m\.)?facebook\.com$/,
    "Facebook",
    /^\/(sharer|share|dialog|plugins|tr|events|groups)\b|\.php/,
  ],
  [
    /^(www\.)?(twitter|x)\.com$/,
    "X",
    /^\/(intent|share|home|search|hashtag|i)\b/,
  ],
  [/^[a-z0-9-]+\.bandcamp\.com$/, "Bandcamp", /^\/(track|album)\//],
  [/^(www\.)?tiktok\.com$/, "TikTok", /^\/(?!@)/],
];

/** The act's own profiles, from the links on its homepage. One per network. */
export function socialLinks(html: string): ActLink[] {
  const found = new Map<string, string>();
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"'\s]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1]!);
    } catch {
      continue;
    }
    const path = url.pathname.replace(/\/+$/, "");
    if (!path) continue;
    for (const [host, label, notProfile] of SOCIAL_HOSTS) {
      if (
        host.test(url.hostname) &&
        !notProfile.test(path) &&
        !found.has(label)
      ) {
        found.set(label, `https://${url.hostname}${path}`);
      }
    }
  }
  return [...found].map(([label, url]) => ({ label, url }));
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Addresses no owner should write to about a gig.
const SKIP =
  /^(no-?reply|donotreply|privacy|legal|abuse|webmaster|wordpress|example|user|name|email|your|support|orders?|shop|store|merch|press|pr|media|licensing|sync|fanclub|newsletter)@|@(example\.|sentry|wixpress|domain\.|email\.com$)|\.(png|jpe?g|gif|webp|svg)$/i;
const BOOKING = /book|agent|agency|live|tour|gig|promot/i;
const MANAGEMENT = /manag|mgmt/i;
// Words in the label next to an address, matched whole so "deliver" isn't "live".
const BOOKING_LABEL =
  /\b(book\w*|agent|agency|live|touring|gigs?|promot\w*)\b/i;
const MANAGEMENT_LABEL = /\b(manag\w*|mgmt)\b/i;
const PRESS_LABEL = /\b(pr|press|publicity|media|publicist)\b\s*:?/i;

/** "booking [at] act.com" and "booking (at) act (dot) com" as plain addresses. */
function deobfuscate(text: string): string {
  return text
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, ".");
}

const RANK = { booking: 0, management: 1, general: 2 } as const;

function kindOf(
  address: string,
  context: string,
): ContactEmail["kind"] | "press" {
  // The address itself counts: booking@…, …@someagency.com, …@actmgmt.com.
  const [local, domain] = address.split("@") as [string, string];
  if (
    BOOKING.test(local) ||
    /agency|booking|touring/i.test(domain) ||
    BOOKING_LABEL.test(context)
  )
    return "booking";
  if (
    MANAGEMENT.test(local) ||
    MANAGEMENT.test(domain) ||
    MANAGEMENT_LABEL.test(context)
  )
    return "management";
  if (PRESS_LABEL.test(context)) return "press";
  return "general";
}

/**
 * Email addresses printed on a page, labelled by what they're for. Booking
 * first. An address often appears twice (in the mailto link, then as text
 * after its label), so each one keeps the strongest label any appearance has.
 */
export function extractEmails(html: string, source: string): ContactEmail[] {
  const text = deobfuscate(
    html.replace(/&#64;|&commat;/gi, "@").replace(/%40/g, "@"),
  );
  const kinds = new Map<string, Set<ContactEmail["kind"] | "press">>();
  for (const m of text.matchAll(EMAIL)) {
    const address = m[0].toLowerCase().replace(/^mailto:/, "");
    if (SKIP.test(address)) continue;
    const at = m.index ?? 0;
    // Only the address's own element says what it's for.
    const context = (
      text
        .slice(Math.max(0, at - 160), at)
        .split(/<\/(?:p|li|div|h\d|tr|td|section|a)>|\n\s*\n/i)
        .pop() ?? ""
    ).replace(/<[^>]+>/g, " ");
    const set = kinds.get(address) ?? new Set();
    set.add(kindOf(address, context));
    kinds.set(address, set);
  }
  const out: ContactEmail[] = [];
  for (const [address, set] of kinds) {
    if (set.has("press") && !set.has("booking") && !set.has("management"))
      continue;
    const kind = set.has("booking")
      ? "booking"
      : set.has("management")
        ? "management"
        : "general";
    out.push({ address, kind, source });
  }
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/** Links on the act's own site that look like a contact or booking page. */
export function contactPageLinks(html: string, base: string): string[] {
  const host = new URL(base).host;
  const out: string[] = [];
  for (const m of html.matchAll(
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const [, href, label] = m;
    if (!/contact|booking|enquir|inquir/i.test(`${href} ${label}`)) continue;
    try {
      const url = new URL(href!, base);
      if (url.host !== host || !/^https?:$/.test(url.protocol)) continue;
      if (!out.includes(url.href)) out.push(url.href);
    } catch {
      /* not a URL */
    }
  }
  return out.slice(0, 2);
}

const PARKED =
  /domain (name )?(is )?for sale|buy this domain|this domain may be for sale|parked free/i;

function siteRoot(host: string): string {
  return host
    .replace(/^www\./, "")
    .split(".")
    .slice(-2)
    .join(".");
}

/**
 * Booking and management addresses count wherever they're printed. A general
 * inbox only counts on the act's own domain or its contact page; otherwise
 * it's usually the record label's front desk.
 */
export function isForTheAct(e: ContactEmail, website: string): boolean {
  if (e.kind !== "general") return true;
  const own = siteRoot(new URL(website).host);
  return siteRoot(e.address.split("@")[1]!) === own || e.source !== website;
}

async function readPage(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await getResearchFetch()(url, {
    headers: { "User-Agent": RESEARCH_USER_AGENT, Accept: "text/html" },
    signal,
  });
  if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "html"))
    return null;
  return (await res.text()).slice(0, 600_000);
}

/**
 * Reads the act's own website and up to two of its contact pages for a
 * published booking address. Only addresses printed on those pages come
 * back; nothing is guessed from the domain.
 */
export async function findActContacts(
  website: string,
  signal?: AbortSignal,
): Promise<ActContacts> {
  const home = await readPage(website, signal).catch(() => null);
  // A lapsed site parked by a domain seller lists the seller's address.
  if (!home) return { emails: [] };
  if (PARKED.test(home)) return { emails: [], parked: true };
  const pages = contactPageLinks(home, website);
  const emails = extractEmails(home, website);
  for (const page of pages) {
    const html = await readPage(page, signal).catch(() => null);
    if (html) emails.push(...extractEmails(html, page));
  }
  // The same address on two pages keeps its strongest label.
  const best = new Map<string, ContactEmail>();
  for (const e of emails) {
    const had = best.get(e.address);
    if (!had || RANK[e.kind] < RANK[had.kind]) best.set(e.address, e);
  }
  const forTheAct = [...best.values()].filter((e) => isForTheAct(e, website));
  return {
    emails: forTheAct.sort((a, b) => RANK[a.kind] - RANK[b.kind]).slice(0, 3),
    contactPage: pages[0],
    socials: socialLinks(home),
  };
}
