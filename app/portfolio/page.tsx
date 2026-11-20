'use client';

// Portfolio fit: the submission's locations against existing exposure (H3 cells), the coastline,
// and the change in coastal concentration. Distances and 25 km accumulation use Snowflake geospatial.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SUBMISSION, rememberSubmission } from '@/components/Shell';
import { Card, ErrorNote, Kpi, PoweredBy, SourceBadge, Thinking, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Portfolio } from '@/lib/types';

export default function Page() {
  return <Suspense fallback={<Thinking label="Loading portfolio" />}><PortfolioFit /></Suspense>;
}

function PortfolioFit() {
  const id = useSearchParams().get('id') ?? DEFAULT_SUBMISSION;
  useEffect(() => rememberSubmission(id), [id]);
  const p = useAsync(() => data.portfolio(id), [id]);
  const d = useAsync(() => data.detail(id), [id]);
  if (p.error || d.error) return <ErrorNote error={(p.error ?? d.error)!} />;
  if (!p.data || !d.data) return p.loading || d.loading ? <Thinking label="Loading portfolio exposure" /> : <div className="card p-4 text-sm">No locations for {id}.</div>;
  const t = p.data.totals;
  const coastal = p.data.locations.filter((l) => l.coastal);
  const delta = +(t.zoneShareAfter - t.zoneShareBefore).toFixed(1);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs muted mb-1"><Link href="/" className="underline">Queue</Link> / <Link href={`/submission/?id=${id}`} className="underline">{id}</Link> / Portfolio fit</div>
        <h1 className="page-title">{d.data.row.insured}: portfolio fit</h1>
        <div className="flex flex-wrap gap-2 mt-2"><SourceBadge p={p.data} /><PoweredBy>Geospatial: ST_DISTANCE, ST_DWITHIN, H3</PoweredBy></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Submission TIV" value={money(t.submissionTiv)} sub={`${p.data.locations.length} locations, ${coastal.length} coastal`} />
        <Kpi label="Coastal TIV added" value={money(t.submissionCoastalTiv)} sub="Within 16 km of the coast (FL, TX, LA)" />
        <Kpi label="Portfolio TIV within 25 km" value={money(t.nearbyTiv)} sub="Summed around each coastal location" />
        <Kpi label="Coastal share of portfolio" value={`${t.zoneShareAfter}%`} sub={`${t.zoneShareBefore}% today · ${delta >= 0 ? '+' : ''}${delta} pts if bound`} />
      </div>
      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 min-w-0" title="Exposure map" right={<span className="text-[11px] muted">Circles: portfolio TIV by H3 cell (res 5) · diamonds: this submission</span>}>
          <ExposureMap p={p.data} />
        </Card>
        <Card className="min-w-0" title="Concentration impact">
          {coastal.length ? (
            <p className="text-sm text-2 mb-3">{coastal.length} of {p.data.locations.length} locations sit within 16 km of the coast, adding {money(t.submissionCoastalTiv)} of coastal TIV where the portfolio already holds {money(t.nearbyTiv)} within 25 km. On this synthetic data set, binding it moves the coastal share of total insured value from {t.zoneShareBefore}% to {t.zoneShareAfter}%.</p>
          ) : <p className="text-sm text-2 mb-3">No location is within 16 km of the coast, so this risk adds no coastal accumulation. Coastal share stays near {t.zoneShareBefore}%.</p>}
          <div className="relative overflow-x-auto -mx-4">
            <table className="data-table min-w-[360px]">
              <thead><tr><th>Loc</th><th>City</th><th className="text-right">TIV</th><th className="text-right">Coast</th><th className="text-right">Portfolio ≤25 km</th></tr></thead>
              <tbody>{p.data.locations.map((l) => (
                <tr key={l.loc}><td>{l.loc}</td><td className="text-xs">{l.city}, {l.state}<div className="muted text-[10px]">{l.construction} · {l.yearBuilt}</div></td>
                  <td className="text-right tabular">{money(l.tiv)}</td>
                  <td className="text-right tabular" style={{ color: l.coastal ? 'var(--negative)' : undefined }}>{l.kmToCoast} km</td>
                  <td className="text-right tabular">{money(l.nearbyTiv)}<div className="muted text-[10px]">{l.nearbyPolicies} policies</div></td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg" style={{ background: 'var(--surface-2)' }} role="img" aria-label="Map of portfolio exposure and submission locations">
        <polyline fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 4" points={p.coast.map(([la, lo]) => `${X(lo)},${Y(la)}`).join(' ')} />
        {p.cells.filter((c) => inBox(c.lat, c.lon)).map((c, i) => (
          <circle key={i} cx={X(c.lon)} cy={Y(c.lat)} r={3 + 22 * Math.sqrt(c.tiv / maxTiv) * (zoom === 'risk' ? 1.6 : 1)} fill="var(--chart-4)" fillOpacity={0.28} stroke="var(--chart-4)" strokeOpacity={0.6}>
            <title>{`${c.locations} portfolio locations · ${money(c.tiv)} TIV`}</title>
          </circle>
        ))}
        {p.locations.map((l) => (
          <g key={l.loc} transform={`translate(${X(l.lon)},${Y(l.lat)})`}>
            <rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" fill={l.coastal ? 'var(--negative)' : 'var(--positive)'} stroke="#fff" strokeWidth={1.5} />
            <text x={10} y={4} fontSize={12} fill="var(--text)" fontWeight={600}>{l.loc}</text>
            <title>{`Location ${l.loc}: ${l.city} · ${money(l.tiv)} · ${l.kmToCoast} km to coast`}</title>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-[11px] muted mt-2">
        <span><span style={{ color: 'var(--chart-1)' }}>- - -</span> Coastline (simplified)</span>
        <span><span style={{ color: 'var(--chart-4)' }}>●</span> Existing portfolio</span>
        <span><span style={{ color: 'var(--negative)' }}>◆</span> Coastal location</span>
        <span><span style={{ color: 'var(--positive)' }}>◆</span> Inland location</span>
      </div>
    </div>
  );
}
