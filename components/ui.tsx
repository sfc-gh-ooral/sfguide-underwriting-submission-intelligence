'use client';

// Shared UI kit for the Quorvane desk: panels, KPI tiles with counters and sparklines, status pills,
// "Powered by" tags, provenance badges, skeletons, and a small markdown renderer for AI text.
import { AlertTriangle, Bot, Database, Sparkles, Timer } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Appetite, Provenance } from '@/lib/types';

export const money = (x: number): string => {
  if (x < 0) return `−${money(-x)}`;
  return x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `$${Math.round(x / 1e3)}K` : `$${Math.round(x)}`;
};

export function Panel({ title, kicker, right, children, className = '', pad = true }: { title?: ReactNode; kicker?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`sheet ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3.5 pb-2">
          <div className="min-w-0">{kicker && <div className="label mb-0.5">{kicker}</div>}{title && <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>}</div>
          {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={pad ? 'px-4 pb-4' : ''}>{children}</div>
    </section>
  );
}

/** Counts up to a number once, on first render. Honors reduced motion. */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const t0 = performance.now(); let id = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(target * (1 - (1 - k) ** 3)); if (k < 1) id = requestAnimationFrame(step); else done.current = true; };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return v;
}

export function Spark({ values, color = 'var(--saffron)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), W = 84, H = 26;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(' ');
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" /></svg>;
}

export function Kpi({ label, value, format, sub, tone, spark }: { label: string; value: number; format: (n: number) => string; sub?: ReactNode; tone?: 'sea' | 'amber' | 'rust'; spark?: number[] }) {
  const v = useCountUp(value);
  return (
    <div className="sheet sheet-lift px-4 py-3 min-w-0">
      <div className="label truncate">{label}</div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="num text-[26px] leading-none font-semibold" style={tone ? { color: `var(--${tone})` } : undefined}>{format(v)}</div>
        {spark && <Spark values={spark} />}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  );
}

/** Names the Snowflake capability behind a component (only capabilities that ran in Live mode). */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <span className="powered"><Sparkles className="w-3 h-3 shrink-0" aria-hidden />Powered by {children}</span>;
}

export function SampleAiBadge() {
  return <span className="pill pill-saffron" title="Recorded in no-account mode, not live Cortex output"><Bot className="w-3 h-3" aria-hidden />Sample AI response</span>;
}

/** Where data came from; latency only when measured in Live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <span className="pill pill-plain"><Database className="w-3 h-3" aria-hidden />Sample data</span>;
  return <span className="pill pill-sea" title="Round trip from the app server to Snowflake"><Timer className="w-3 h-3" aria-hidden />Live · {p.role}{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden />; }

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-80" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

// Minimal markdown: headings by bold, lists, tables, bold/italic. Text is escaped by React.
function inline(s: string, key: number): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g).filter(Boolean);
  return <span key={key}>{parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
      : (p.startsWith('_') && p.endsWith('_')) || (p.startsWith('*') && p.endsWith('*')) ? <em key={i}>{p.slice(1, -1)}</em>
        : p)}</span>;
}
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      out.push(<table key={k++}><thead><tr>{body[0].map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
      const li = items.map((t, j) => <li key={j}>{inline(t, j)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { i++; continue; } // horizontal rule
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className="prose-ai text-sm leading-relaxed">{out}</div>;
}

export function AppetitePill({ a }: { a: Appetite }) {
  const m = { IN: ['pill-sea', 'In appetite'], REFER: ['pill-amber', 'Refer'], OUT: ['pill-rust', 'Out of appetite'] }[a];
  return <span className={`pill ${m[0]}`}><span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />{m[1]}</span>;
}

export function CompletenessPill({ missing }: { missing: string[] }) {
  return missing.length
    ? <span className="pill pill-amber" title={`Missing: ${missing.join(', ')}`}>Missing {missing.length}</span>
    : <span className="pill pill-plain">Complete</span>;
}

export const fitTone = (v: number) => (v >= 75 ? 'var(--sea)' : v >= 50 ? 'var(--saffron-ink)' : v >= 30 ? 'var(--amber)' : 'var(--rust)');

export function FitMeter({ value, wide = false }: { value: number; wide?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${wide ? 'w-full' : 'min-w-[96px]'}`} title={`Fit score ${value.toFixed(1)} of 100`}>
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--sheet-2)' }}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${value}%`, background: fitTone(value) }} />
      </div>
      <span className="num text-[13px] font-semibold w-7 text-right" style={{ color: fitTone(value) }}>{Math.round(value)}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return (
    <div role="alert" className="sheet p-4 text-sm flex gap-3" style={{ borderColor: 'var(--rust)' }}>
      <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--rust)' }} aria-hidden />
      <div><strong style={{ color: 'var(--rust)' }}>Live request failed.</strong> {error} The app does not fall back to sample data in Live mode; switch to Sample in the top bar to use the bundled data.</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="inset px-4 py-8 text-center"><div className="font-semibold">{title}</div>{children && <div className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>{children}</div>}</div>;
}
