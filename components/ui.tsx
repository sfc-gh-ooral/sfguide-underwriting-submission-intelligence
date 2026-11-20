'use client';

// Small shared UI pieces: badges, cards, KPI tiles, and a tiny markdown renderer for AI text.
import { Bot, Database, Sparkles, Timer } from 'lucide-react';
import type { Appetite } from '@/lib/types';
import type { ReactNode } from 'react';
import type { Provenance } from '@/lib/types';

export const money = (x: number): string => {
  if (x < 0) return `−${money(-x)}`;
  return x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `$${Math.round(x / 1e3)}K` : `$${Math.round(x)}`;
};

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi card-hover p-4">
      <div className="text-[11px] uppercase tracking-wider muted mb-1 font-semibold">{label}</div>
      <div className="kpi-value text-[26px] font-bold tabular tracking-tight">{value}</div>
      {sub && <div className="text-xs muted mt-1">{sub}</div>}
    </div>
  );
}

function Pill({ children, color, bg, title }: { children: ReactNode; color: string; bg: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <Pill color="var(--accent)" bg="var(--accent-soft)"><Sparkles className="w-3 h-3" aria-hidden />Powered by {children}</Pill>;
}

export function SampleAiBadge() {
  return <Pill color="var(--sample)" bg="var(--sample-soft)" title="Scripted answer in no-account mode, not live Cortex output"><Bot className="w-3 h-3" aria-hidden />Sample AI response</Pill>;
}

/** Shows where data came from; latency only when measured in live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <Pill color="var(--muted)" bg="var(--surface-2)"><Database className="w-3 h-3" aria-hidden />Sample data</Pill>;
  return (
    <Pill color="var(--text-2)" bg="var(--surface-2)" title="Measured round trip from the app server to Snowflake">
      <Timer className="w-3 h-3" aria-hidden />Live · {p.role}{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}
    </Pill>
  );
}

export function Thinking({ label = 'Thinking' }: { label?: string }) {
  return <div className="thinking text-xs muted flex items-center gap-2" role="status"><span /><span /><span />{label}…</div>;
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

export function AppetiteBadge({ a }: { a: Appetite }) {
  const m = { IN: ['var(--positive)', 'In appetite'], REFER: ['var(--warning)', 'Refer'], OUT: ['var(--negative)', 'Out of appetite'] }[a];
  return <Pill color={m[0]} bg={`color-mix(in srgb, ${m[0]} 14%, transparent)`}>{m[1]}</Pill>;
}

export function CompletenessBadge({ missing }: { missing: string[] }) {
  return missing.length
    ? <Pill color="var(--warning)" bg="color-mix(in srgb, var(--warning) 14%, transparent)" title={`Missing: ${missing.join(', ')}`}>Missing {missing.length}</Pill>
    : <Pill color="var(--positive)" bg="color-mix(in srgb, var(--positive) 14%, transparent)">Complete</Pill>;
}

export function FitBar({ value }: { value: number }) {
  const color = value >= 75 ? 'var(--positive)' : value >= 50 ? 'var(--accent)' : value >= 30 ? 'var(--warning)' : 'var(--negative)';
  return (
    <div className="flex items-center gap-2 min-w-[92px]" title={`Fit score ${value.toFixed(1)} of 100`}>
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} /></div>
      <span className="text-xs font-semibold tabular w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return <div role="alert" className="card p-4 text-sm" style={{ color: 'var(--negative)' }}><strong>Live request failed.</strong> {error} The app does not fall back to sample data in Live mode; switch to Sample in the header to use the bundled data.</div>;
}
