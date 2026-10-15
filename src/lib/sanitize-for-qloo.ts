const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

/** Strip obvious PII before text is sent to Qloo (SAFE_USE). */
export function sanitizeForQloo(text: string): string {
  return text
    .replace(EMAIL_RE, "")
    .replace(PHONE_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Drop lines that look like personal names in free text (heuristic). */
export function stripLikelyPersonalNames(text: string): string {
  return text
    .split(/\n|,/g)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      const words = t.split(/\s+/);
      if (words.length === 2 && /^[A-Z][a-z]+$/.test(words[0]!) && /^[A-Z][a-z]+$/.test(words[1]!)) {
        return false;
      }
      return true;
    })
    .join(", ");
}
