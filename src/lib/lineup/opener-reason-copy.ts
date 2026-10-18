/** One-line opener pick / swap reason for the poster (not audit codes). */
export function humanOpenerPickReason(reason: string): string {
  switch (reason) {
    case "origin matches venue":
      return "Local act whose origin matches this city.";
    case "fits opener pool for this room (no origin on file)":
      return "Fits the room's opener slot (no public origin on file).";
    case "origin not specific enough":
      return "In the opener pool; public origin wasn't city-specific.";
    default:
      return reason.replace(/_/g, " ");
  }
}
