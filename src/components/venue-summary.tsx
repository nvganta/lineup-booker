"use client";

import { Button } from "@/components/ui/button";
import type { LineupRequest } from "@/lib/lineup/schemas";
import { CalendarDays, MapPin, Music2, Users, UtensilsCrossed } from "lucide-react";

type Props = {
  request: LineupRequest;
  /** From Qloo's skew, once analytics land: "Ages 35–44 · leans male". */
  audience: string | null;
  onEdit: () => void;
  disabled?: boolean;
};

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-[#8c4a32]/80 shrink-0">{icon}</span>
      <div className="min-w-0 border-l border-[#e8dfd6] pl-3">
        <p className="text-[13px] font-medium text-[#1a1614] mb-0.5">{label}</p>
        <div className="text-[13px] leading-snug text-[#5c534d]">{children}</div>
      </div>
    </div>
  );
}

/** What the owner told us, played back, with one way to change it. */
export function VenueSummary({ request, audience, onEdit, disabled }: Props) {
  return (
    <div className="space-y-5" data-venue-summary>
      <Row icon={<UtensilsCrossed className="size-4" strokeWidth={1.75} />} label="Venue">
        <p>{request.concept}</p>
      </Row>
      <Row icon={<MapPin className="size-4" strokeWidth={1.75} />} label="Address">
        <p>{request.location}</p>
      </Row>
      <Row icon={<Music2 className="size-4" strokeWidth={1.75} />} label="Vibe">
        <p>{request.regularsLove}</p>
      </Row>
      <Row icon={<Users className="size-4" strokeWidth={1.75} />} label="Audience">
        <p>{audience ?? "Reading Qloo's crowd skew…"}</p>
        <p className="text-[11px] text-[#8a7f76] mt-0.5">From Qloo, not from you.</p>
      </Row>
      <Row icon={<CalendarDays className="size-4" strokeWidth={1.75} />} label="Date">
        <p className={request.when ? "" : "italic text-[#8a7f76]"}>
          {request.when || "Not set"}
        </p>
      </Row>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onEdit}
        className="w-full rounded-full border-[#d4c4b5] text-[#8c4a32] hover:bg-[#f7f2eb]"
        data-edit-details
      >
        Edit details
      </Button>
    </div>
  );
}
