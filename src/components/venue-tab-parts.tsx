import { cn } from "@/lib/utils";

export const POSTER_ARTICLE_CLASS = cn(
  "relative mx-auto w-full max-w-xl rounded-sm border border-[#e8dfd6] bg-[#f7f2eb] text-[#1a1614]",
  "shadow-[0_1px_0_rgba(26,22,20,0.06),0_20px_40px_-24px_rgba(26,22,20,0.22)]",
);

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase leading-[1.2] tracking-[0.22em] text-[#6b5c52] mb-2",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function DraftedBadge({ source }: { source: "agent" | "template" }) {
  return (
    <span
      data-drafted-label
      className="inline-block rounded-[2px] border border-dashed border-[#8c4a32]/50 px-1.5 py-[3px] text-[9px] font-medium uppercase leading-none tracking-[0.18em] text-[#8c4a32]"
    >
      {source === "agent" ? "Drafted by the agent" : "Drafted from the data"}
    </span>
  );
}

export function TabSection({
  children,
  last,
  className,
}: {
  children: React.ReactNode;
  last?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "px-5 py-3",
        !last && "border-b border-[#e8dfd6]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Card title only; the tab above already names the section. */
export function TabHeader({ title }: { title: string }) {
  return (
    <header className="px-5 pt-3.5 pb-2.5 border-b border-[#e0d5ca]">
      <p className="font-heading text-[22px] leading-[1.15]">{title}</p>
    </header>
  );
}

export function Swatch({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[11px] text-[#6b5c52]">
      <span className="inline-block h-[6px] w-2.5 rounded-[1px]" style={{ background: color }} />
      {children}
    </span>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-snug text-[#6b5c52]">{children}</p>;
}

export function SourceNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-[11px] leading-[1.4] text-[#8a7f76]", className)}>
      {children}
    </p>
  );
}

export function TabLoading({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className={cn(
        POSTER_ARTICLE_CLASS,
        "max-w-none min-h-[320px] flex items-center justify-center text-sm text-[#8a7f76]",
      )}
    >
      {label}
    </div>
  );
}
