"use client";

import {
  crowdAgeSkewRows,
  crowdSkewMaxAbs,
  formatSkewIndex,
  genderSkewSummary,
} from "@/lib/lineup/crowd-skew-display";
import type { CrowdDemographics } from "@/lib/lineup/pitch-analytics";

type Props = {
  demographics: CrowdDemographics;
};

export function CrowdSkewBars({ demographics }: Props) {
  const ageRows = crowdAgeSkewRows(demographics);
  const maxAbs = crowdSkewMaxAbs(ageRows);
  const genderLine = genderSkewSummary(demographics.gender);

  if (ageRows.length === 0 && !genderLine) return null;

  return (
    <div className="space-y-3">
      {ageRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#8a7f76] px-0.5">
            <span>under-indexed</span>
            <span>over-indexed</span>
          </div>
          <ul className="space-y-2 list-none">
            {ageRows.map((row) => {
              const v = row.value;
              const widthPct = (Math.abs(v) / maxAbs) * 50;
              const isOver = v >= 0;
              return (
                <li key={row.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs text-[#5c534d]">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{formatSkewIndex(v)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-[#e8dfd6]">
                    <div
                      className="absolute top-0 bottom-0 w-px bg-[#c4b5a8]"
                      style={{ left: "50%" }}
                    />
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-[#8c4a32]/75"
                      style={
                        isOver
                          ? {
                              left: "50%",
                              width: `${widthPct}%`,
                            }
                          : {
                              right: "50%",
                              width: `${widthPct}%`,
                            }
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {genderLine && (
        <p className="text-xs text-[#5c534d]">
          Gender skew: {genderLine}
        </p>
      )}
    </div>
  );
}
