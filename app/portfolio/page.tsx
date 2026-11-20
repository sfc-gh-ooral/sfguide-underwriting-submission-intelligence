'use client';

// Portfolio fit: the submission's locations against existing exposure (H3 cells), the coastline,
// and the change in coastal concentration. Distances and 25 km accumulation use Snowflake geospatial.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SUBMISSION, rememberSubmission } from '@/components/Shell';
import { ChevronLeft } from 'lucide-react';
import { Empty, ErrorNote, Kpi, PageSkeleton, Panel, PoweredBy, SourceBadge, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Portfolio } from '@/lib/types';

export default function Page() {
  return <Suspense fallback={<PageSkeleton label="Loading portfolio" />}><PortfolioFit /></Suspense>;
}

function PortfolioFit() {
  const id = useSearchParams().get('id') ?? DEFAULT_SUBMISSION;
  useEffect(() => rememberSubmission(id), [id]);
  const p = useAsync(() => data.portfolio(id), [id]);
  const d = useAsync(() => data.detail(id), [id]);
  if (p.error || d.error) return <ErrorNote error={(p.error ?? d.error)!} />;
  if (!p.data || !d.data) return p.loading || d.loading ? <PageSkeleton label="Loading portfolio exposure" /> : <Empty title={`No locations for ${id}`} />;
  const t = p.data.totals;
  const coastal = p.data.locations.filter((l) => l.coastal);
  const delta = +(t.zoneShareAfter - t.zoneShareBefore).toFixed(1);
  const maxShare = Math.max(t.zoneShareAfter, 1) * 1.15;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/submission/?id=${id}`} className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--ink-3)' }}><ChevronLeft className="w-3.5 h-3.5" aria-hidden />{id} file</Link>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <div className="min-w-0">
            <div className="label">Portfolio fit · accumulation check</div>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{d.data.row.insured}</h1>
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>Where this schedule lands against the book we already write, and what it does to coastal concentration.</p>
          </div>
          <div className="flex flex-wrap gap-2"><SourceBadge p={p.data} /><PoweredBy>Geospatial: ST_DISTANCE, ST_DWITHIN, H3</PoweredBy></div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Submission TIV" value={t.submissionTiv} format={money} sub={`${p.data.locations.length} locations, ${coastal.length} coastal`} />
        <Kpi label="Coastal TIV added" value={t.submissionCoastalTiv} format={money} tone={t.submissionCoastalTiv > 0 ? 'rust' : 'sea'} sub="Within 16 km of the coast" />
        <Kpi label="Book TIV within 25 km" value={t.nearbyTiv} format={money} sub="Around each submitted location" />
        <Kpi label="Coastal share if bound" value={t.zoneShareAfter} format={(n) => `${n.toFixed(1)}%`} tone={delta > 0.5 ? 'rust' : undefined} sub={`${t.zoneShareBefore}% today · ${delta >= 0 ? '+' : ''}${delta} pts`} />
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <Panel kicker="Exposure map" title="Submission against the existing book" right={<span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Dots: book TIV by H3 cell (res 5) · pins: this submission</span>}>
          <ExposureMap p={p.data} />
        </Panel>
        <div className="space-y-4 min-w-0">
          <Panel kicker="Concentration impact" title={coastal.length ? `${coastal.length} of ${p.data.locations.length} locations are coastal` : 'No coastal accumulation'}>
            <p className="text-sm mb-3" style={{ color: 'var(--ink-2)' }}>{coastal.length
              ? <>This schedule adds <strong className="num">{money(t.submissionCoastalTiv)}</strong> of coastal TIV where the book already holds <strong className="num">{money(t.nearbyTiv)}</strong> within 25 km. On this synthetic data set, binding it moves the coastal share of total insured value from {t.zoneShareBefore}% to {t.zoneShareAfter}%.</>
              : <>No location is within 16 km of the coast, so the coastal share stays near {t.zoneShareBefore}%.</>}</p>
            <div className="space-y-2" aria-label="Coastal share before and after binding">
              {[['Today', t.zoneShareBefore, 'var(--sea)'], ['If bound', t.zoneShareAfter, delta > 0.5 ? 'var(--rust)' : 'var(--sea)']].map(([l, v, c]) => (
                <div key={l as string} className="grid grid-cols-[64px_1fr_52px] items-center gap-2 text-xs">
                  <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                  <span className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--sheet-2)' }}><span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${((v as number) / maxShare) * 100}%`, background: c as string }} /></span>
                  <span className="num text-right font-semibold">{(v as number).toFixed(1)}%</span>
                </div>))}
            </div>
          </Panel>
          <Panel pad={false} kicker="Schedule" title="Locations">
            <div className="relative overflow-x-auto">
              <table className="dtable min-w-[380px]">
                <thead><tr><th>#</th><th>City</th><th className="!text-right">TIV</th><th className="!text-right">Coast</th><th className="!text-right">Book ≤25 km</th></tr></thead>
                <tbody>{p.data.locations.map((l) => (
                  <tr key={l.loc}><td className="num">{l.loc}</td><td className="text-xs">{l.city}, {l.state}<div style={{ color: 'var(--ink-3)' }}>{l.construction} · {l.yearBuilt}</div></td>
                    <td className="text-right num">{money(l.tiv)}</td>
                    <td className="text-right">{l.coastal ? <span className="pill pill-rust num">{l.kmToCoast} km</span> : <span className="num">{l.kmToCoast} km</span>}</td>
                    <td className="text-right num">{money(l.nearbyTiv)}<div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{l.nearbyPolicies} policies</div></td></tr>))}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ExposureMap({ p }: { p: Portfolio }) {
  const [zoom, setZoom] = useState<'risk' | 'all'>('risk');
  const box = useMemo(() => {
    if (zoom === 'all') return { lat0: 24, lat1: 43, lon0: -113, lon1: -70 };
    const la = p.locations.map((l) => l.lat), lo = p.locations.map((l) => l.lon);
    const pad = 1.4;
    return { lat0: Math.min(...la) - pad, lat1: Math.max(...la) + pad, lon0: Math.min(...lo) - pad * 1.4, lon1: Math.max(...lo) + pad * 1.4 };
  }, [zoom, p.locations]);
  const W = 800, H = 480;
  const k = Math.cos(((box.lat0 + box.lat1) / 2) * Math.PI / 180);
  const sx = W / ((box.lon1 - box.lon0) * k), sy = H / (box.lat1 - box.lat0), s = Math.min(sx, sy);
  const ox = (W - (box.lon1 - box.lon0) * k * s) / 2, oy = (H - (box.lat1 - box.lat0) * s) / 2;
  const X = (lon: number) => ox + (lon - box.lon0) * k * s, Y = (lat: number) => oy + (box.lat1 - lat) * s;
  const maxTiv = Math.max(...p.cells.map((c) => c.tiv));
  const inBox = (lat: number, lon: number) => lat > box.lat0 - 1 && lat < box.lat1 + 1 && lon > box.lon0 - 1 && lon < box.lon1 + 1;
  return (
    <div>
      <div className="seg flex w-max mb-2" role="group" aria-label="Map extent">
        <button aria-pressed={zoom === 'risk'} onClick={() => setZoom('risk')} className="px-3 py-1 text-xs font-medium">Around this risk</button>
        <button aria-pressed={zoom === 'all'} onClick={() => setZoom('all')} className="px-3 py-1 text-xs font-medium">Whole portfolio</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg" style={{ background: 'var(--sheet-2)' }} role="img" aria-label="Map of portfolio exposure and submission locations">
        <polyline fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="6 5" points={p.coast.map(([la, lo]) => `${X(lo)},${Y(la)}`).join(' ')} />
        {p.cells.filter((c) => inBox(c.lat, c.lon)).map((c, i) => (
          <circle key={i} cx={X(c.lon)} cy={Y(c.lat)} r={3 + 22 * Math.sqrt(c.tiv / maxTiv) * (zoom === 'risk' ? 1.6 : 1)} fill="var(--saffron)" fillOpacity={0.3} stroke="var(--saffron-ink)" strokeOpacity={0.5}>
            <title>{`${c.locations} portfolio locations · ${money(c.tiv)} TIV`}</title>
          </circle>
        ))}
        {p.locations.map((l) => (
          <g key={l.loc} transform={`translate(${X(l.lon)},${Y(l.lat)})`}>
            <path d="M0 0 C-7 -9 -9 -13 -9 -17 A9 9 0 1 1 9 -17 C9 -13 7 -9 0 0Z" fill={l.coastal ? 'var(--rust)' : 'var(--sea)'} stroke="var(--sheet)" strokeWidth={1.5} />
            <text x={0} y={-13.5} fontSize={10} textAnchor="middle" fill="var(--sheet)" fontWeight={700}>{l.loc}</text>
            <title>{`Location ${l.loc}: ${l.city} · ${money(l.tiv)} · ${l.kmToCoast} km to coast`}</title>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-[11px] mt-2" style={{ color: 'var(--ink-3)' }}>
        <span><span style={{ color: 'var(--ink-3)' }}>- - -</span> Coastline (simplified)</span>
        <span><span style={{ color: 'var(--saffron)' }}>●</span> Existing book</span>
        <span><span style={{ color: 'var(--rust)' }}>⬤</span> Coastal location (≤16 km)</span>
        <span><span style={{ color: 'var(--sea)' }}>⬤</span> Inland location</span>
      </div>
    </div>
  );
}
