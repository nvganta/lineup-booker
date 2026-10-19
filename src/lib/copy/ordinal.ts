/** English ordinal suffix for 0–100 style percentiles (62 → "62nd"). */
export function ordinal(n: number): string {
  const v = Math.abs(Math.round(n));
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}

export function popularityPercentileLine(percentile: number): string {
  const pct = Math.round(percentile * 100);
  return `${ordinal(pct)} percentile for listener reach`;
}
