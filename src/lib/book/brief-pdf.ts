/**
 * A one-page booking brief as a PDF, with no library: built-in PDF fonts
 * (Times for headings, Helvetica for text) and simple word wrap.
 */
export type Brief = {
  title: string;
  venueLine: string;
  neighborhoods: string[];
  ideas: Array<{ title: string; stat?: string; body: string }>;
  posts: string[];
  note: string;
};

const W = 612;
const H = 792;
const M = 56;
const TERRA = "0.549 0.290 0.196";
const INK = "0.102 0.086 0.078";
const MUTE = "0.361 0.325 0.302";

const WIN_ANSI: Record<string, number> = {
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "•": 0x95, "…": 0x85, "·": 0xb7,
};

function encode(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    const c = code > 255 ? 63 : code;
    if (c === 40 || c === 41 || c === 92) out += "\\" + String.fromCharCode(c);
    else if (c < 32 || c > 126) out += "\\" + c.toString(8).padStart(3, "0");
    else out += String.fromCharCode(c);
  }
  return out;
}

/** Rough average glyph widths, enough to wrap lines inside the margins. */
function wrap(text: string, size: number, serif: boolean, width = W - 2 * M): string[] {
  const per = size * (serif ? 0.46 : 0.5);
  const max = Math.floor(width / per);
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export function buildBriefPdf(b: Brief): Uint8Array {
  const ops: string[] = [];
  let y = H - M;
  const text = (s: string, x: number, size: number, font: "F1" | "F2", color: string) =>
    ops.push(`BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${encode(s)}) Tj ET`);
  const label = (s: string) => {
    y -= 22;
    text(s.toUpperCase().split("").join(" "), M, 7.5, "F2", MUTE);
    y -= 6;
  };
  const rule = () => ops.push(`0.91 0.875 0.839 RG 0.6 w ${M} ${y} m ${W - M} ${y} l S`);

  text("O N E   N I G H T", M, 7.5, "F2", TERRA);
  y -= 26;
  for (const l of wrap(b.title, 24, true)) {
    text(l, M, 24, "F1", INK);
    y -= 26;
  }
  text(b.venueLine, M, 10, "F2", MUTE);
  y -= 8;

  if (b.neighborhoods.length) {
    label("Where to poster");
    for (const [i, n] of b.neighborhoods.entries()) {
      y -= 15;
      text(String(i + 1), M, 12, "F1", TERRA);
      text(n, M + 16, 10.5, "F2", INK);
    }
  }

  if (b.ideas.length) {
    label("Ideas");
    for (const idea of b.ideas) {
      y -= 8;
      rule();
      y -= 16;
      text(idea.title, M, 14, "F1", INK);
      if (idea.stat) text(idea.stat, W - M - idea.stat.length * 5, 9.5, "F2", TERRA);
      for (const l of wrap(idea.body, 9.5, false)) {
        y -= 13;
        text(l, M, 9.5, "F2", MUTE);
      }
    }
  }

  if (b.posts.length) {
    label("Posts");
    for (const post of b.posts) {
      y -= 4;
      for (const l of wrap(post, 10.5, false)) {
        y -= 14;
        text(l, M, 10.5, "F2", INK);
      }
      y -= 4;
    }
  }

  y = M - 10;
  text(b.note, M, 8, "F2", MUTE);

  const content = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, o] of objs.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
