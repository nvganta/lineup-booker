"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { CalendarDays, MapPin, Music2, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  value: LineupRequest;
  onChange: (data: LineupRequest) => void;
  onSubmit: (data: LineupRequest) => void;
  loading: boolean;
  addressError?: string | null;
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
}: Props) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-none">
      <header className="space-y-1">
        <h1 className="font-display text-[1.75rem] xl:text-[2rem] text-balance leading-[1.08] text-[#1a1614]">
          Book the room they&apos;ll show up for
        </h1>
        <p className="text-sm text-[#6b5c52]">
          Three lines about your room. The scout does the rest.
        </p>
      </header>

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
              placeholder="Natural wine bar, 120 seats"
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
              placeholder="2509 Main St, Vancouver, BC"
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
              placeholder="Indie folk, vinyl nights"
              className="min-h-[4.5rem] pl-10 text-base bg-[#fcf9f5] border-[#e8dfd6] rounded-lg resize-none py-2.5"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="when" className="text-sm text-[#1a1614]">
            Date <span className="text-[#8a7f76] font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <FieldIcon>
              <CalendarDays className="size-4" strokeWidth={1.75} />
            </FieldIcon>
            <Input
              id="when"
              value={value.when ?? ""}
              onChange={(e) => onChange({ ...value, when: e.target.value })}
              placeholder="Sat 8 Nov · 8 PM"
              maxLength={60}
              className="h-11 pl-10 text-base bg-[#fcf9f5] border-[#e8dfd6] rounded-lg"
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
