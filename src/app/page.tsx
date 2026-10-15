"use client";

import { LineupCard } from "@/components/lineup-card";
import { LineupForm } from "@/components/lineup-form";
import { ProvenancePanel } from "@/components/provenance-panel";
import type { LineupResult } from "@/lib/lineup/build-lineup";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { useState } from "react";

function LoadingPlaceholder() {
  return (
    <div
      className="max-w-md space-y-3 py-8"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="font-heading text-2xl text-muted-foreground">
        Reading nearby taste
      </p>
      <p className="text-base text-muted-foreground/80 leading-relaxed">
        Tags, artists, and neighborhoods for your pin.
      </p>
    </div>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [lineup, setLineup] = useState<LineupResult | null>(null);

  async function handleSubmit(data: LineupRequest) {
    setLoading(true);
    setError(null);
    setAddressError(null);
    setLineup(null);
    try {
      const res = await fetch("/api/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as {
        lineup?: LineupResult;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (json.code === "geocode") {
          setAddressError(json.error ?? "Couldn't find that address.");
        } else {
          setError(json.error ?? "Something went wrong.");
        }
        return;
      }
      setLineup(json.lineup ?? null);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-full">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 lg:px-10">
        <div className="grid gap-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 items-start">
          <LineupForm
            onSubmit={handleSubmit}
            loading={loading}
            addressError={addressError}
          />

          <div className="lg:pt-8 min-h-[320px]">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-border bg-muted/40 px-6 py-5 text-base leading-relaxed max-w-xl"
              >
                {error}
              </div>
            )}

            {loading && <LoadingPlaceholder />}

            {!error && !lineup && !loading && (
              <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
                Your lineup card will appear here — headliner, opener, and
                neighborhoods to target.
              </p>
            )}

            {lineup && !loading && (
              <div className="animate-lineup-settle">
                <LineupCard lineup={lineup} />
                <ProvenancePanel provenance={lineup.provenance} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
