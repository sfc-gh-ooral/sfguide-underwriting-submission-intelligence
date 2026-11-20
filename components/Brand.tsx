// Quorvane logo mark: a submission (saffron chevron) dropping onto a ledger. See docs/DESIGN.md.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#17384B" />
      <path d="M9 9l7 6 7-6" fill="none" stroke="#E0A33A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 19h14M9 23h10" stroke="#F6F2EA" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <LogoMark />
      <span className="leading-tight min-w-0 hidden sm:block">
        <span className="block text-[15px] font-semibold tracking-tight" style={{ color: 'var(--bar-text)' }}>Quorvane</span>
        <span className="block text-[10.5px] uppercase tracking-[.14em] truncate" style={{ color: 'var(--bar-muted)' }}>Submission desk</span>
      </span>
    </span>
  );
}
