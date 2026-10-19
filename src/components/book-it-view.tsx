"use client";

import { useEffect, useState } from "react";
import type { BookingEmail, BookingInput } from "@/lib/book/booking-email";
import type { VenueInsightsState } from "@/hooks/use-venue-insights";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DraftedBadge, POSTER_ARTICLE_CLASS, SectionLabel } from "@/components/venue-tab-parts";

const memo = new Map<string, BookingEmail>();

function useBookingEmail(input: BookingInput) {
  const key = JSON.stringify(input);
  const [, bump] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (memo.has(key)) return;
    let live = true;
    fetch("/api/book-it", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
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
  return { email: memo.get(key) ?? null, failed: failedKey === key && !memo.has(key) };
}

type Props = {
  input: BookingInput;
  insights: VenueInsightsState;
  fileSlug: string;
  onBack: () => void;
};

export function BookItView({ input, insights, fileSlug, onBack }: Props) {
  const { email, failed } = useBookingEmail(input);
  const [copied, setCopied] = useState(false);
  const copy = insights.status === "ready" && insights.copy.status === "ready" ? insights.copy.copy : null;
  const copyPending = insights.status === "loading" || insights.status === "idle" || (insights.status === "ready" && insights.copy.status === "loading");
  const title = input.opener ? `${input.headliner} with ${input.opener}` : input.headliner;

  const handleCopy = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const handlePdf = async () => {
    const { buildBriefPdf } = await import("@/lib/book/brief-pdf");
    const bytes = buildBriefPdf({
      title,
      venueLine: `${input.venueLabel} · ${input.address}`,
      neighborhoods: input.neighborhoods,
      ideas: (copy?.ideas ?? []).slice(0, 3).map((i) => ({ title: i.title, stat: i.basis, body: i.body })),
      posts: (copy?.captions ?? []).slice(0, 2),
      note: copy?.source === "template" ? "Drafted from the data. Check before sending." : "Drafted by the agent. Check before sending.",
    });
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileSlug}-brief.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const mailto = email
    ? `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
    : undefined;

  return (
    <div className="space-y-3" data-book-view>
      <button type="button" onClick={onBack} className="text-[12px] text-[#6b5c52] underline underline-offset-2 cursor-pointer">
        Back to the lineup
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-book="email">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-[#e0d5ca]">
            <SectionLabel>Email</SectionLabel>
            {email && <DraftedBadge source={email.source} />}
          </div>
          {email ? (
            <div className="px-5 py-3">
              <p className="font-heading text-[17px] leading-snug">{email.subject}</p>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.55] text-[#3d3530]">{email.body}</p>
              <div className="flex flex-wrap gap-2.5 mt-3.5">
                <Button type="button" variant="outline" className="rounded-full border-[#e0d5ca] text-sm" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy email"}
                </Button>
                <a href={mailto} className="inline-flex items-center rounded-full border border-[#e0d5ca] px-4 h-9 text-sm hover:bg-[#f0e8df]">
                  Open in mail
                </a>
              </div>
            </div>
          ) : (
            <p className="px-5 py-6 text-[13px] italic text-[#8a7f76]" aria-busy={!failed}>
              {failed ? "The email didn't draft this time." : "Drafting the email…"}
            </p>
          )}
        </article>

        <article className={cn(POSTER_ARTICLE_CLASS, "max-w-none")} data-book="brief">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-[#e0d5ca]">
            <SectionLabel>Brief</SectionLabel>
            {copy && <DraftedBadge source={copy.source} />}
          </div>
          <div className="px-5 py-3">
            <p className="font-heading text-[19px] leading-tight">{title}</p>
            <p className="text-[12px] text-[#6b5c52] mt-0.5">{input.venueLabel}</p>
            {input.neighborhoods.length > 0 && (
              <p className="text-[12px] text-[#5c534d] mt-2">{input.neighborhoods.join(" · ")}</p>
            )}
            {copy ? (
              <ul className="mt-2.5 space-y-1 list-none">
                {copy.ideas.slice(0, 3).map((i) => (
                  <li key={i.title} className="text-[13px] leading-snug">
                    <span className="font-heading">{i.title}</span>
                    {i.basis && <span className="text-[#8c4a32] text-[12px]"> · {i.basis}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 text-[12px] italic text-[#8a7f76]" aria-busy={copyPending}>{copyPending ? "Drafting ideas and posts…" : "Ideas weren't available."}</p>
            )}
            <Button type="button" className="mt-3.5 rounded-full bg-[#8c4a32] hover:bg-[#7a3f2a] text-white text-sm" onClick={handlePdf} disabled={copyPending}>
              Download brief (PDF)
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}
