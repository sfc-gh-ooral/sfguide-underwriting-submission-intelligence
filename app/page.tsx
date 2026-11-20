'use client';

// Submission queue: open submissions ranked by fit score (or first in, first out), with
// completeness and appetite badges from AI_EXTRACT, AI_CLASSIFY, and the scoring view.
import { ArrowDownWideNarrow, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rememberSubmission } from '@/components/Shell';
import { AppetiteBadge, Card, CompletenessBadge, ErrorNote, FitBar, Kpi, PoweredBy, SourceBadge, Thinking, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Appetite } from '@/lib/types';

type Sort = 'fit' | 'fifo';

export default function QueuePage() {
  const q = useAsync(() => data.queue(), []);
  const [sort, setSort] = useState<Sort>('fit');
  const [filter, setFilter] = useState<Appetite | 'ALL' | 'INCOMPLETE'>('ALL');
  const router = useRouter();
  const rows = useMemo(() => {
    const r = (q.data?.rows ?? []).filter((x) => filter === 'ALL' || (filter === 'INCOMPLETE' ? x.missing.length > 0 : x.appetite === filter));
    return [...r].sort((a, b) => (sort === 'fit' ? b.fit - a.fit : a.fifo - b.fifo));
  }, [q.data, sort, filter]);

  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data) return <Thinking label="Loading the submission queue" />;
  const { kpis, byDay } = q.data;
  const open = (id: string) => { rememberSubmission(id); router.push(`/submission/?id=${id}`); };

  return (
    <div className="space-y-5">
      <div className="hero">
        <div className="relative z-10 max-w-3xl">
          <div className="text-xs uppercase tracking-wider opacity-80 font-semibold mb-1">Submission queue</div>
          <h1 className="text-2xl font-bold leading-tight mb-1">Work the best-fit risks first, not just the oldest.</h1>
          <p className="text-sm opacity-90">Every broker packet is parsed and extracted in Snowflake, checked against the appetite guide, and scored for fit, completeness, broker value, loss history, and coastal concentration.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Open submissions" value={String(kpis.open)} sub={`${money(kpis.tiv)} total insured value`} />
        <Kpi label="Average wait" value={`${kpis.avgDays} days`} sub="Since the broker email arrived" />
        <Kpi label="In appetite" value={`${kpis.inAppetitePct}%`} sub="No referral reasons" />
        <Kpi label="Incomplete" value={String(kpis.incomplete)} sub="Missing a required document" />
        <Kpi label="Out of appetite" value={String(kpis.out)} sub="Decline candidates" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 min-w-0" title="Submissions received per day (last 30 days)" right={<SourceBadge p={q.data} />}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ left: -24, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }} />
                <Bar dataKey="count" name="Submissions" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="How the fit score works" right={<PoweredBy>SQL view SUBMISSION_SCORES</PoweredBy>}>
          <ul className="text-xs space-y-1.5 text-2">
            <li><strong>Appetite (35):</strong> class from AI_CLASSIFY, territory, TIV, and loss rules. Out of appetite caps the score at 15.</li>
            <li><strong>Completeness (20):</strong> application, statement of values, five years of loss runs.</li>
            <li><strong>Broker value (25):</strong> broker tier plus hit ratio.</li>
            <li><strong>Loss history (15):</strong> five-year incurred from the AI_EXTRACT loss run table.</li>
            <li><strong>Concentration (10):</strong> TIV added within 16 km of the coast (geospatial).</li>
          </ul>
        </Card>
      </div>

      <Card title={`Queue · ${rows.length} submissions`} className="min-w-0"
        right={<>
          <div className="seg flex" role="group" aria-label="Sort order">
            <button aria-pressed={sort === 'fit'} onClick={() => setSort('fit')} className="px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1"><ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden />Fit score</button>
            <button aria-pressed={sort === 'fifo'} onClick={() => setSort('fifo')} className="px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden />First in</button>
          </div>
          <select aria-label="Filter" className="btn !py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="ALL">All</option><option value="IN">In appetite</option><option value="REFER">Refer</option><option value="OUT">Out of appetite</option><option value="INCOMPLETE">Incomplete</option>
          </select>
          <PoweredBy>AI_EXTRACT · AI_CLASSIFY</PoweredBy>
        </>}>
        <div className="relative overflow-x-auto -mx-4">
          <table className="data-table min-w-[860px]">
            <thead><tr><th>Rank</th><th>Submission</th><th>Class</th><th>Broker</th><th className="text-right">TIV</th><th>Docs</th><th>Appetite</th><th>Fit</th><th className="text-right">Waiting</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="click" onClick={() => open(r.id)}>
                  <td className="tabular muted text-xs">{i + 1}<span className="block text-[10px]">FIFO #{r.fifo}</span></td>
                  <td><Link href={`/submission/?id=${r.id}`} onClick={(e) => { e.stopPropagation(); rememberSubmission(r.id); }} className="font-medium no-underline hover:underline">{r.insured}</Link>
                    <div className="text-xs muted">{r.id} · {r.city}, {r.state}</div></td>
                  <td className="text-xs">{r.className}{r.predictedClass !== r.declaredClass && <div className="text-[10px]" style={{ color: 'var(--negative)' }}>declared {r.declaredClass}</div>}</td>
                  <td className="text-xs">{r.broker}<div className="muted text-[10px]">{r.brokerTier}</div></td>
                  <td className="text-right tabular">{money(r.tiv)}</td>
                  <td><CompletenessBadge missing={r.missing} /></td>
                  <td><AppetiteBadge a={r.appetite} /></td>
                  <td><FitBar value={r.fit} /></td>
                  <td className="text-right tabular text-xs">{r.daysWaiting} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
