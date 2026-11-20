'use client';

// Docket: the underwriter's inbox. KPI strip, arrivals and appetite mix, then a split pane: the ranked
// submission list (sort, filter, search) and a preview of the selected file with its fit components.
import { ArrowDownUp, ArrowRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BUSINESS_DATE, rememberSubmission } from '@/components/Shell';
import { AppetitePill, CompletenessPill, Empty, ErrorNote, FitMeter, Kpi, PageSkeleton, Panel, PoweredBy, SourceBadge, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Appetite, QueueRow } from '@/lib/types';

type SortKey = 'fit' | 'fifo' | 'tiv' | 'daysWaiting';
const SORTS: { key: SortKey; label: string }[] = [{ key: 'fit', label: 'Fit score' }, { key: 'fifo', label: 'First in, first out' }, { key: 'tiv', label: 'TIV' }, { key: 'daysWaiting', label: 'Days waiting' }];
const TIP = { background: 'var(--sheet)', border: '1px solid var(--rule)', borderRadius: 8, fontSize: 12, color: 'var(--ink)' };

export default function Docket() {
  const q = useAsync(() => data.queue(), []);
  const [sort, setSort] = useState<SortKey>('fit');
  const [appetite, setAppetite] = useState<'ALL' | Appetite>('ALL');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [tier, setTier] = useState('ALL');
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string>();
  const [sheet, setSheet] = useState(false);

  const rows = useMemo(() => {
    const r = (q.data?.rows ?? []).filter((x) => (appetite === 'ALL' || x.appetite === appetite) && (!onlyIncomplete || x.missing.length > 0) && (tier === 'ALL' || x.brokerTier === tier)
      && (!text || `${x.id} ${x.insured} ${x.city} ${x.state} ${x.className} ${x.broker}`.toLowerCase().includes(text.toLowerCase())));
    return [...r].sort((a, b) => (sort === 'fifo' ? a.fifo - b.fifo : (b[sort] as number) - (a[sort] as number)));
  }, [q.data, sort, appetite, onlyIncomplete, tier, text]);
  useEffect(() => { if (!sel && rows[0]) setSel(rows[0].id); }, [rows, sel]);

  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data) return <PageSkeleton label="Loading the docket" />;
  const k = q.data.kpis, all = q.data.rows;
  const selected = all.find((r) => r.id === sel);
  const mix = (['IN', 'REFER', 'OUT'] as Appetite[]).map((a) => ({ name: { IN: 'In appetite', REFER: 'Refer', OUT: 'Out' }[a], v: all.filter((r) => r.appetite === a).length, c: { IN: 'var(--sea)', REFER: 'var(--amber)', OUT: 'var(--rust)' }[a] }));
  const days = q.data.byDay.slice(-21);
  const tiers = [...new Set(all.map((r) => r.brokerTier))];
  const pick = (id: string) => { setSel(id); rememberSubmission(id); setSheet(true); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-serif italic text-[15px]" style={{ color: 'var(--saffron-ink)' }}>Morning docket · {BUSINESS_DATE}</div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{k.open} submissions waiting. Start with the best fit.</h1>
          <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--ink-2)' }}>Every broker file is parsed, checked against the appetite guide and scored for fit, so the risks worth quoting rise to the top instead of waiting their turn.</p>
        </div>
        <div className="flex flex-wrap gap-2"><SourceBadge p={q.data} /><PoweredBy>AI_EXTRACT · AI_CLASSIFY · SUBMISSION_SCORES view</PoweredBy></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Open submissions" value={k.open} format={(n) => Math.round(n).toString()} spark={days.map((d) => d.count)} sub="Arrivals, last 21 days" />
        <Kpi label="Avg days waiting" value={k.avgDays} format={(n) => n.toFixed(1)} sub="Since broker sent the file" />
        <Kpi label="In appetite" value={k.inAppetitePct} format={(n) => `${Math.round(n)}%`} tone="sea" sub="No referral or decline reason" />
        <Kpi label="Incomplete" value={k.incomplete} format={(n) => Math.round(n).toString()} tone="amber" sub="Missing loss runs, SOV or app fields" />
        <Kpi label="Out of appetite" value={k.out} format={(n) => Math.round(n).toString()} tone="rust" sub="Score capped at 15" />
        <Kpi label="TIV on the docket" value={k.tiv} format={money} sub="Sum of submitted schedules" />
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Panel className="lg:col-span-2" kicker="Intake" title="Submissions received per day" right={<span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Last 21 days to {BUSINESS_DATE}</span>}>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ left: -24, right: 4, top: 6 }}>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--saffron) 12%, transparent)' }} contentStyle={TIP} formatter={(v) => [v, 'Submissions']} />
                <Bar dataKey="count" fill="var(--sea)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel kicker="Appetite check" title="Where the docket stands">
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={mix} dataKey="v" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={2} stroke="var(--sheet)">{mix.map((m) => <Cell key={m.name} fill={m.c} />)}</Pie><Tooltip contentStyle={TIP} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm flex-1">
              {mix.map((m) => (
                <li key={m.name}><button className="w-full flex items-center justify-between gap-2 hover:underline" onClick={() => setAppetite({ 'In appetite': 'IN', Refer: 'REFER', Out: 'OUT' }[m.name] as Appetite)}>
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.c }} aria-hidden />{m.name}</span><span className="num font-semibold">{m.v}</span></button></li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 items-start">
        <Panel pad={false} kicker="Work queue" title="Ranked submissions"
          right={<div className="seg" role="group" aria-label="Rank by">{SORTS.slice(0, 2).map((s) => <button key={s.key} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>{s.label}</button>)}</div>}>
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            <label className="relative flex-1 min-w-[180px]"><span className="sr-only">Search submissions</span>
              <Search className="w-4 h-4 absolute left-2.5 top-2.5" style={{ color: 'var(--ink-3)' }} aria-hidden />
              <input className="field !pl-8" placeholder="Insured, city, class, broker" value={text} onChange={(e) => setText(e.target.value)} /></label>
            <label className="sr-only" htmlFor="f-app">Appetite</label>
            <select id="f-app" className="field !w-auto" value={appetite} onChange={(e) => setAppetite(e.target.value as 'ALL' | Appetite)}>
              <option value="ALL">All appetite</option><option value="IN">In appetite</option><option value="REFER">Refer</option><option value="OUT">Out of appetite</option></select>
            <label className="sr-only" htmlFor="f-tier">Broker tier</label>
            <select id="f-tier" className="field !w-auto" value={tier} onChange={(e) => setTier(e.target.value)}><option value="ALL">All broker tiers</option>{tiers.map((t) => <option key={t}>{t}</option>)}</select>
            <button className={`btn ${onlyIncomplete ? 'btn-saffron' : ''}`} aria-pressed={onlyIncomplete} onClick={() => setOnlyIncomplete(!onlyIncomplete)}>Incomplete only</button>
          </div>
          <div className="relative overflow-auto max-h-[640px] border-t" style={{ borderColor: 'var(--rule)' }}>
            {rows.length === 0 ? <div className="p-4"><Empty title="No submissions match">Clear a filter to see more of the docket.</Empty></div> : (
              <table className="dtable min-w-[680px]" aria-label="Submissions">
                <thead><tr>
                  <th>{sort === 'fifo' ? 'FIFO' : 'Rank'}</th><th>Insured</th>
                  <th><button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort('tiv')}>TIV<ArrowDownUp className="w-3 h-3" aria-hidden /></button></th>
                  <th>Appetite</th><th><button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort('fit')}>Fit<ArrowDownUp className="w-3 h-3" aria-hidden /></button></th>
                  <th><button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort('daysWaiting')}>Waiting<ArrowDownUp className="w-3 h-3" aria-hidden /></button></th>
                </tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={r.id} className="docket-row" style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }} aria-selected={r.id === sel} tabIndex={0}
                    onClick={() => pick(r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r.id); } }}>
                    <td className="num" style={{ color: 'var(--ink-3)' }}>{sort === 'fifo' ? r.fifo : i + 1}</td>
                    <td className="min-w-[220px]"><div className="font-semibold">{r.insured}</div>
                      <div className="text-xs" style={{ color: 'var(--ink-3)' }}><span className="num">{r.id}</span> · {r.city}, {r.state} · {r.className}</div></td>
                    <td className="num">{money(r.tiv)}</td>
                    <td><div className="flex flex-col gap-1 items-start"><AppetitePill a={r.appetite} /><CompletenessPill missing={r.missing} /></div></td>
                    <td><FitMeter value={r.fit} /></td>
                    <td className="num text-xs">{r.daysWaiting} d<div style={{ color: 'var(--ink-3)' }}>FIFO #{r.fifo}</div></td>
                  </tr>))}</tbody>
              </table>)}
          </div>
          <div className="px-4 py-2 text-xs border-t" style={{ borderColor: 'var(--rule)', color: 'var(--ink-3)' }}>{rows.length} of {all.length} open submissions · ranked by {SORTS.find((s) => s.key === sort)!.label.toLowerCase()}</div>
        </Panel>

        {selected && (
          <>
            <div className="hidden xl:block sticky top-[68px]"><Preview r={selected} /></div>
            {sheet && (
              <div className="xl:hidden fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setSheet(false)}>
                <div role="dialog" aria-modal="true" aria-label={`Preview of ${selected.insured}`} className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl fade-in" style={{ background: 'var(--paper)' }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end p-2"><button className="btn !px-2" onClick={() => setSheet(false)} aria-label="Close preview"><X className="w-4 h-4" /></button></div>
                  <div className="px-3 pb-4"><Preview r={selected} /></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const COMPONENTS: { key: keyof QueueRow['pts']; label: string; max: number }[] = [
  { key: 'appetite', label: 'Appetite', max: 35 }, { key: 'broker', label: 'Broker value', max: 25 }, { key: 'completeness', label: 'Completeness', max: 20 },
  { key: 'loss', label: 'Loss history', max: 15 }, { key: 'concentration', label: 'Concentration', max: 10 },
];

function Preview({ r }: { r: QueueRow }) {
  const jump = r.fifo - 1;
  return (
    <Panel kicker={`${r.id} · received ${r.receivedAt.slice(0, 10)}`} title={r.insured}>
      <div className="text-sm" style={{ color: 'var(--ink-2)' }}>{r.city}, {r.state} · {r.className} · <span className="num">{money(r.tiv)}</span> TIV</div>
      <div className="text-sm" style={{ color: 'var(--ink-2)' }}>{r.broker} <span className="pill pill-plain ml-1">{r.brokerTier} broker</span></div>
      <div className="flex flex-wrap gap-2 mt-2"><AppetitePill a={r.appetite} /><CompletenessPill missing={r.missing} />
        {r.predictedClass !== r.declaredClass && <span className="pill pill-rust">Class {r.declaredClass} → {r.predictedClass}</span>}</div>

      <div className="inset p-3 mt-3">
        <div className="flex items-baseline justify-between"><span className="label">Fit score</span><span className="num text-[28px] font-semibold leading-none">{Math.round(r.fit)}<span className="text-sm" style={{ color: 'var(--ink-3)' }}> / 100</span></span></div>
        <ul className="mt-2 space-y-1.5">
          {COMPONENTS.map((c) => (
            <li key={c.key} className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-xs">
              <span style={{ color: 'var(--ink-2)' }}>{c.label}</span>
              <span className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sheet)' }}><span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(r.pts[c.key] / c.max) * 100}%`, background: 'var(--saffron)' }} /></span>
              <span className="num text-right">{r.pts[c.key]}/{c.max}</span>
            </li>))}
        </ul>
        {r.appetite === 'OUT' && <div className="text-xs mt-2" style={{ color: 'var(--rust)' }}>Capped at 15: out of appetite.</div>}
      </div>

      {jump > 20 && <div className="text-sm mt-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--sea) 10%, var(--sheet))', color: 'var(--sea)' }}>
        <strong>FIFO #{r.fifo}.</strong> First in, first out would leave this file behind {jump} others; fit ranking surfaces it now.</div>}

      {(r.reasons.length > 0 || r.missing.length > 0) && (
        <ul className="mt-3 space-y-1 text-sm">
          {r.reasons.map((x) => <li key={x} className="flex gap-2"><span style={{ color: r.appetite === 'OUT' ? 'var(--rust)' : 'var(--amber)' }} aria-hidden>●</span>{x}</li>)}
          {r.missing.map((x) => <li key={x} className="flex gap-2"><span style={{ color: 'var(--amber)' }} aria-hidden>○</span>Missing: {x}</li>)}
        </ul>)}

      <div className="flex flex-wrap gap-2 mt-4">
        <Link href={`/submission/?id=${r.id}`} className="btn btn-primary">Open submission file<ArrowRight className="w-4 h-4" aria-hidden /></Link>
        <Link href={`/portfolio/?id=${r.id}`} className="btn">Portfolio fit</Link>
      </div>
    </Panel>
  );
}
