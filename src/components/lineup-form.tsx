"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExampleVenue } from "@/lib/example-venues";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { cn } from "@/lib/utils";
import { MapPin, Music2, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  value: LineupRequest;
  onChange: (data: LineupRequest) => void;
  onSubmit: (data: LineupRequest) => void;
  loading: boolean;
  addressError?: string | null;
  examples: ExampleVenue[];
  onExampleSelect: (example: ExampleVenue) => void;
};

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="text-[#8c4a32]/80 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
      {children}
    </span>
  );
}

export function LineupForm({
  value,
  onChange,
  onSubmit,
  loading,
  addressError,
  examples,
  onExampleSelect,
}: Props) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-md">
      <header className="space-y-2">
        <p className="text-[11px] tracking-[0.28em] text-[#8c4a32] uppercase">
          Lineup Booker
        </p>
        <h1 className="font-heading text-4xl md:text-[2.75rem] font-medium tracking-tight text-balance leading-[1.05] text-[#1a1614]">
          Book the room they&apos;ll show up for
        </h1>
        <p className="text-base text-[#6b5c52]">
          One lineup—headliner, opener, neighborhoods.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={loading}
            onClick={() => onExampleSelect(ex)}
            className={cn(
              "rounded-full border border-[#e0d5ca] bg-[#fcf9f5] px-3 py-1.5",
              "text-xs text-[#1a1614] hover:border-[#8c4a32]/40 hover:bg-[#f7f2eb]",
              "transition-colors disabled:opacity-50",
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="concept" className="text-sm text-[#1a1614]">
            Concept or cuisine
          </Label>
          <div className="relative">
            <FieldIcon>
              <UtensilsCrossed className="size-4" strokeWidth={1.75} />
            </FieldIcon>
            <Input
              id="concept"
              value={value.concept}
              onChange={(e) =>
                onChange({ ...value, concept: e.target.value })
              }
              className="h-11 pl-10 text-base bg-[#fcf9f5] border-[#e8dfd6] rounded-lg"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm text-[#1a1614]">
            Address
          </Label>
          <div className="relative">
            <FieldIcon>
              <MapPin className="size-4" strokeWidth={1.75} />
            </FieldIcon>
            <Input
              id="location"
              value={value.location}
              onChange={(e) =>
                onChange({ ...value, location: e.target.value })
              }
              className="h-11 pl-10 text-base bg-[#fcf9f5] border-[#e8dfd6] rounded-lg"
              required
            />
          </div>
          {addressError && (
            <p className="text-sm text-destructive leading-relaxed">
              {addressError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="regulars" className="text-sm text-[#1a1614]">
            What regulars love
          </Label>
          <div className="relative">
            <span className="text-[#8c4a32]/80 pointer-events-none absolute left-3 top-3">
              <Music2 className="size-4" strokeWidth={1.75} />
            </span>
            <Textarea
              id="regulars"
              value={value.regularsLove}
              onChange={(e) =>
                onChange({ ...value, regularsLove: e.target.value })
              }
              rows={2}
              className="min-h-[4.5rem] pl-10 text-base bg-[#fcf9f5] border-[#e8dfd6] rounded-lg resize-none py-2.5"
              required
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-11 px-8 text-base rounded-full bg-[#8c4a32] text-[#faf7f2] hover:bg-[#7a4030]"
      >
        {loading ? "Building lineup…" : "Suggest a lineup"}
      </Button>
    </form>
  );
}
