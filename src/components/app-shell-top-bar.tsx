export function AppShellTopBar() {
  return (
    <header className="shrink-0 flex items-center justify-between gap-4 border-b border-[#e8dfd6] bg-[#faf7f2]/95 backdrop-blur-sm px-4 lg:px-5 h-12 z-20">
      <span className="font-heading text-lg text-[#1a1614] tracking-tight">
        Lineup Booker
      </span>
      <a
        href="#how-it-works"
        className="text-sm text-[#6b5c52] hover:text-[#8c4a32] transition-colors"
      >
        How it works
      </a>
    </header>
  );
}
