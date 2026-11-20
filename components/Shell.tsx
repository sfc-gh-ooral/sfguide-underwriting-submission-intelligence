'use client';

// App frame: marine top bar with tabs, environment badge, role chip, theme toggle; the hosted-example
// notice; and the footer disclaimer. No sidebar: on phones the tabs scroll horizontally under the bar.
import { FileSearch, Inbox, Map, MessageSquare, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Wordmark } from '@/components/Brand';
import { ModeChip } from '@/components/ModeChip';
import { HOSTED_EXAMPLE } from '@/lib/hosted';

export const REPO = 'https://github.com/sfc-gh-ooral/sfguide-underwriting-submission-intelligence';
const LAST = 'usi-last-submission';
export const DEFAULT_SUBMISSION = 'SUB-1004';
export const BUSINESS_DATE = '18 Nov 2026';
export const rememberSubmission = (id: string) => window.localStorage.setItem(LAST, id);
export const lastSubmission = () => (typeof window === 'undefined' ? DEFAULT_SUBMISSION : window.localStorage.getItem(LAST) ?? DEFAULT_SUBMISSION);

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);
  const flip = () => { const t = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = t; window.localStorage.setItem('usi-theme', t); setDark(!dark); };
  return (
    <button onClick={flip} className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-white/10" style={{ color: 'var(--bar-text)' }} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
      {dark ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />}
    </button>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [last, setLast] = useState(DEFAULT_SUBMISSION);
  const pathname = usePathname();
  useEffect(() => setLast(lastSubmission()), [pathname]);
  const NAV = [
    { href: '/', label: 'Docket', icon: Inbox },
    { href: `/submission/?id=${last}`, match: '/submission', label: 'Submission file', icon: FileSearch },
    { href: `/portfolio/?id=${last}`, match: '/portfolio', label: 'Portfolio fit', icon: Map },
    { href: '/ask/', match: '/ask', label: 'Ask the desk', icon: MessageSquare },
  ];
  const active = (n: (typeof NAV)[number]) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.match!));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30" style={{ background: 'var(--marine)' }}>
        <div className="max-w-[1480px] mx-auto px-4 lg:px-6 flex items-center gap-6 h-[52px]">
          <Link href="/" className="no-underline shrink-0" aria-label="Quorvane submission desk, docket"><Wordmark /></Link>
          <nav className="hidden md:flex items-center gap-6 h-full" aria-label="Main">
            {NAV.map((n) => <Link key={n.label} href={n.href} className="tab-link" aria-current={active(n) ? 'page' : undefined}><n.icon className="w-4 h-4" aria-hidden />{n.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ModeChip />
            <span className="hidden lg:inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs" style={{ background: 'var(--marine-2)', color: 'var(--bar-text)' }} title="Fictional persona for this example">
              <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--saffron)', color: '#0F2A3A' }}>MO</span>
              M. Okafor · Property UW
            </span>
            <ThemeToggle />
          </div>
        </div>
        <nav className="md:hidden flex gap-5 px-4 overflow-x-auto relative border-t" style={{ borderColor: 'rgba(255,255,255,.08)' }} aria-label="Main">
          {NAV.map((n) => <Link key={n.label} href={n.href} className="tab-link !h-11" aria-current={active(n) ? 'page' : undefined}><n.icon className="w-4 h-4" aria-hidden />{n.label}</Link>)}
        </nav>
      </header>
      {HOSTED_EXAMPLE && (
        <div role="note" className="text-xs border-b" style={{ background: 'color-mix(in srgb, var(--saffron) 14%, var(--paper))', borderColor: 'var(--rule)', color: 'var(--ink-2)' }}>
          <div className="max-w-[1480px] mx-auto px-4 lg:px-6 py-2">
            <strong style={{ color: 'var(--ink)' }}>Hosted example, Sample mode.</strong> Runs in your browser on synthetic data captured from a live Snowflake run. AI drafts are recorded samples, not live Cortex output.{' '}
            <a href={REPO} className="underline underline-offset-2">Run it in your own account</a>
          </div>
        </div>
      )}
      <main key={pathname} className="fade-in flex-1 w-full max-w-[1480px] mx-auto px-4 lg:px-6 py-5">{children}</main>
      <footer className="border-t text-xs" style={{ borderColor: 'var(--rule)', color: 'var(--ink-3)' }}>
        <div className="max-w-[1480px] mx-auto px-4 lg:px-6 py-4 flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span>Quorvane is a fictional desk. Synthetic data and illustrative logic only: not production, underwriting, regulatory, or compliance advice. Every decision stays with the underwriter.</span>
          <a href={REPO} className="underline underline-offset-2">Source and setup guide</a>
        </div>
      </footer>
    </div>
  );
}
