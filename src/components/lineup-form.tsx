"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { useState } from "react";

type Props = {
  onSubmit: (data: LineupRequest) => void;
  loading: boolean;
  addressError?: string | null;
};

export function LineupForm({ onSubmit, loading, addressError }: Props) {
  const [concept, setConcept] = useState(
    "Natural wine and small plates cafe-bar",
  );
  const [location, setLocation] = useState("2509 Main St, Vancouver, BC");
  const [regularsLove, setRegularsLove] = useState(
    "Indie folk and vinyl nights",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ concept, location, regularsLove });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 max-w-xl">
      <header className="space-y-3">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          Lineup Booker
        </p>
        <h1 className="font-heading text-4xl md:text-5xl font-medium tracking-tight text-balance leading-[1.1]">
          Book the room your regulars will actually show up for
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Tell us about your venue. Qloo maps nearby taste — then we suggest a
          headliner, a local opener, and neighborhoods worth promoting.
        </p>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="concept" className="text-base">
            Concept or cuisine
          </Label>
          <Input
            id="concept"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className="h-12 text-base bg-background"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-base">
            Address
          </Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-12 text-base bg-background"
            required
          />
          {addressError && (
            <p className="text-sm text-destructive leading-relaxed">
              {addressError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="regulars" className="text-base">
            What regulars love
          </Label>
          <Textarea
            id="regulars"
            value={regularsLove}
            onChange={(e) => setRegularsLove(e.target.value)}
            rows={3}
            className="min-h-[7.5rem] text-base bg-background resize-none py-3"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-12 px-8 text-base rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {loading ? "Reading the room…" : "Suggest a lineup"}
      </Button>
    </form>
  );
}
