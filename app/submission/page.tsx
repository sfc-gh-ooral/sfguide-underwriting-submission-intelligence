'use client';

// Submission detail: AI_EXTRACT fields with source highlights on the document, missing items,
// the appetite check with Cortex Search guide passages, loss-run charts, an AI_COMPLETE memo,
// and the underwriter's decision (request info, decline, or move to quote).
import { Check, FileText, Mail, Map as MapIcon, Send, Sparkles, ThumbsDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Reasoning } from '@/components/Reasoning';
import { DEFAULT_SUBMISSION, rememberSubmission } from '@/components/Shell';
import { AppetiteBadge, Card, CompletenessBadge, ErrorNote, FitBar, Markdown, PoweredBy, SampleAiBadge, SourceBadge, Thinking, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { AiText, Detail } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DECLINE_REASONS = ['Class outside appetite', 'Territory outside appetite', 'Exceeds capacity or TIV limits', 'Loss history', 'Incomplete submission', 'Other'];
const LABEL: Record<string, string> = { REQUEST_INFO: 'Requested information', DECLINE: 'Declined', QUOTE: 'Moved to quote' };

export default function Page() {
  return <Suspense fallback={<Thinking label="Loading submission" />}><SubmissionDetail /></Suspense>;
}

function SubmissionDetail() {
  const id = useSearchParams().get('id') ?? DEFAULT_SUBMISSION;
  useEffect(() => rememberSubmission(id), [id]);
  const [reload, setReload] = useState(0);
  const d = useAsync(() => data.detail(id), [id, reload]);
  if (d.error) return <ErrorNote error={d.error} />;
  if (!d.data) return d.loading ? <Thinking label="Loading submission" /> : <div className="card p-4 text-sm">Submission {id} is not in the open queue. <Link className="underline" href="/">Back to the queue</Link></div>;
  return <DetailView d={d.data} onDecided={() => setReload((x) => x + 1)} />;
}

function DetailView({ d, onDecided }: { d: Detail; onDecided: () => void }) {
  const r = d.row;
  const [doc, setDoc] = useState<'application' | 'loss_runs'>('application');
  const [focus, setFocus] = useState<string>('insured_name');
  const focused = d.fields.find((f) => f.key === focus);
  const lossesTotal = d.losses?.reduce((a, l) => ({ c: a.c + l.claims, i: a.i + l.incurred, o: a.o + l.open }), { c: 0, i: 0, o: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0">
          <div className="text-xs muted mb-1"><Link href="/" className="underline">Queue</Link> / {r.id}</div>
          <h1 className="page-title">{r.insured}</h1>
          <div className="text-sm text-2 mt-1">{r.city}, {r.state} · {r.className} · {money(r.tiv)} TIV · {r.broker} ({r.brokerTier}) · waiting {r.daysWaiting} days (FIFO #{r.fifo})</div>
          <div className="flex flex-wrap gap-2 mt-2"><AppetiteBadge a={r.appetite} /><CompletenessBadge missing={r.missing} /><SourceBadge p={d} /></div>
        </div>
        <div className="card p-3 w-full sm:w-72">
          <div className="text-[11px] uppercase tracking-wider muted font-semibold mb-1">Fit score</div>
          <FitBar value={r.fit} />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2 tabular">
            <dt className="muted">Appetite</dt><dd className="text-right">{r.pts.appetite} / 35</dd>
            <dt className="muted">Completeness</dt><dd className="text-right">{r.pts.completeness} / 20</dd>
            <dt className="muted">Broker value</dt><dd className="text-right">{r.pts.broker} / 25</dd>
            <dt className="muted">Loss history</dt><dd className="text-right">{r.pts.loss} / 15</dd>
            <dt className="muted">Concentration</dt><dd className="text-right">{r.pts.concentration} / 10</dd>
          </dl>
          {r.appetite === 'OUT' && <div className="text-[11px] mt-1" style={{ color: 'var(--negative)' }}>Capped at 15: out of appetite</div>}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card className="min-w-0" title={<span className="inline-flex items-center gap-2"><FileText className="w-4 h-4" aria-hidden />Broker documents</span>}
          right={<>
            <div className="seg flex" role="group" aria-label="Document">
              <button aria-pressed={doc === 'application'} onClick={() => setDoc('application')} className="px-3 py-1 text-xs font-medium">Application</button>
              <button aria-pressed={doc === 'loss_runs'} onClick={() => setDoc('loss_runs')} className="px-3 py-1 text-xs font-medium" disabled={!d.losses}>Loss runs</button>
            </div>
            <PoweredBy>AI_PARSE_DOCUMENT · AI_EXTRACT citations</PoweredBy>
          </>}>
          <div className="relative mx-auto max-w-[520px] rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/docs/${r.id}_${doc}.svg`} alt={`${doc === 'application' ? 'Application' : 'Loss run'} PDF for ${r.insured}`} className="w-full block" />
            {doc === 'application' && focused?.boxes.map((b, i) => (
              <div key={i} className="absolute rounded-sm pointer-events-none" aria-hidden
                style={{ left: `${b.upperLeft[0]}%`, top: `${b.upperLeft[1]}%`, width: `${b.lowerRight[0] - b.upperLeft[0]}%`, height: `${b.lowerRight[1] - b.upperLeft[1]}%`, background: 'rgba(41,181,232,.28)', outline: '2px solid #29b5e8' }} />
            ))}
          </div>
          <p className="text-[11px] muted mt-2">{d.parsedChars.toLocaleString()} characters parsed with AI_PARSE_DOCUMENT (OCR mode). Select a field to see where AI_EXTRACT found it.</p>
        </Card>

        <Card className="min-w-0" title="Extracted fields" right={<PoweredBy>AI_EXTRACT</PoweredBy>}>
          <div className="grid sm:grid-cols-2 gap-2">
            {d.fields.map((f) => (
              <button key={f.key} onClick={() => { setFocus(f.key); setDoc('application'); }} aria-pressed={focus === f.key}
                className="text-left rounded-lg border px-3 py-2 transition-colors" style={{ borderColor: focus === f.key ? 'var(--brand)' : 'var(--border)', background: focus === f.key ? 'var(--accent-soft)' : 'transparent' }}>
                <div className="text-[10px] uppercase tracking-wider muted font-semibold">{f.label}</div>
                <div className="text-sm font-medium break-words">{f.value || '—'}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-lg p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
            <div className="text-[10px] uppercase tracking-wider muted font-semibold mb-1">Nature of operations</div>
            {d.operations}
            <div className="text-xs mt-2">Governing class (AI_CLASSIFY): <strong>{r.predictedClass}</strong> {r.className}
              {r.predictedClass !== r.declaredClass && <span style={{ color: 'var(--negative)' }}> · application declares {r.declaredClass}</span>}</div>
          </div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="min-w-0" title="Appetite check" right={<PoweredBy>Cortex Search</PoweredBy>}>
          {r.reasons.length ? <ul className="text-sm space-y-1 mb-3">{r.reasons.map((x) => <li key={x} className="flex gap-2"><span style={{ color: r.appetite === 'OUT' ? 'var(--negative)' : 'var(--warning)' }}>●</span>{x}</li>)}</ul>
            : <p className="text-sm mb-3 flex items-center gap-2"><Check className="w-4 h-4" style={{ color: 'var(--positive)' }} aria-hidden />No referral or decline reasons.</p>}
          {r.missing.length > 0 && <div className="text-sm mb-3 rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}><strong>Missing:</strong> {r.missing.join(', ')}</div>}
          <div className="text-[10px] uppercase tracking-wider muted font-semibold mb-1">Relevant appetite guide passages</div>
          <ul className="space-y-2">{d.guide.map((g) => <li key={g.ruleId} className="text-xs"><strong>{g.ruleId} · {g.section}</strong> <span className="muted">({g.appetite})</span><div className="text-2">{g.text}</div></li>)}</ul>
        </Card>

        <Card className="min-w-0" title="Loss history (5 years)" right={<PoweredBy>AI_EXTRACT table extraction</PoweredBy>}>
          {d.losses ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={d.losses} margin={{ left: -10, right: 0, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="a" tickFormatter={(v: number) => money(v)} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="b" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={24} />
                    <Tooltip formatter={(v, n) => (n === 'Claims' ? v : money(Number(v)))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }} />
                    <Bar yAxisId="a" dataKey="incurred" name="Incurred" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="a" dataKey="paid" name="Paid" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="b" dataKey="claims" name="Claims" stroke="var(--chart-4)" strokeWidth={2} dot />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-2 mt-1">{lossesTotal!.c} claims · {money(lossesTotal!.i)} incurred · {lossesTotal!.o} open · largest: {d.losses.filter((l) => l.largest !== 'None').map((l) => `${l.year} ${l.largest}`).join(', ') || 'none'}</div>
            </>
          ) : <div className="text-sm rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}>No loss runs in this submission. Request five years of currently valued loss runs before quoting.</div>}
        </Card>

        <Card className="min-w-0" title={<span className="inline-flex items-center gap-2"><Mail className="w-4 h-4" aria-hidden />Broker email</span>}>
          <div className="text-xs muted">{d.email.from} · {d.email.sentAt.slice(0, 10)}</div>
          <div className="text-sm font-medium mt-1">{d.email.subject}</div>
          <p className="text-sm text-2 mt-2">{d.email.body}</p>
          <Link href={`/portfolio/?id=${r.id}`} className="btn mt-3 text-xs inline-flex items-center gap-1 no-underline"><MapIcon className="w-3.5 h-3.5" aria-hidden />Check portfolio fit ({d.locations.length} locations)</Link>
        </Card>
      </div>

      <Memo id={r.id} />
      <Actions d={d} onDecided={onDecided} />
    </div>
  );
}

function AiResult({ a }: { a: AiText }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">{a.source === 'mock' ? <SampleAiBadge /> : <SourceBadge p={a} />}{a.sources.map((s) => <span key={s} className="text-[11px] muted">{s}</span>)}</div>
      <Markdown text={a.text} />
    </div>
  );
}

function Memo({ id }: { id: string }) {
  const [state, setState] = useState<{ busy?: boolean; a?: AiText; error?: string }>({});
  const run = () => { setState({ busy: true }); data.memo(id).then((a) => setState({ a }), (e) => setState({ error: String(e.message ?? e) })); };
  return (
    <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: 'var(--ai)' }} aria-hidden />Underwriting memo draft</span>}
      right={<><PoweredBy>AI_COMPLETE + Cortex Search</PoweredBy><button className="btn btn-ai text-xs" onClick={run} disabled={state.busy}>{state.a ? 'Redraft' : 'Draft memo'}</button></>}>
      {state.busy ? <Reasoning kind="memo" /> : state.error ? <ErrorNote error={state.error} /> : state.a ? <AiResult a={state.a} />
        : <p className="text-sm muted">Draft a memo from the extracted fields, loss runs, appetite reasons, exposure, and the appetite guide passages. The underwriter reviews and edits it; it is not a decision.</p>}
    </Card>
  );
}

function Actions({ d, onDecided }: { d: Detail; onDecided: () => void }) {
  const [mode, setMode] = useState<'none' | 'info' | 'decline' | 'quote'>('none');
  const [email, setEmail] = useState<{ busy?: boolean; a?: AiText; text?: string; error?: string }>({});
  const [reason, setReason] = useState(d.row.appetite === 'OUT' ? DECLINE_REASONS[0] : d.row.missing.length ? DECLINE_REASONS[4] : DECLINE_REASONS[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const draft = () => { setMode('info'); setEmail({ busy: true }); data.brokerEmail(d.row.id).then((a) => setEmail({ a, text: a.text }), (e) => setEmail({ error: String(e.message ?? e) })); };
  const save = async (decision: 'REQUEST_INFO' | 'DECLINE' | 'QUOTE', why: string) => {
    setSaving(true); setError(undefined);
    try { await data.decide(d.row.id, decision, why); setMode('none'); setNote(''); onDecided(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setSaving(false); }
  };

  return (
    <Card title="Decision" right={<span className="text-[11px] muted">Recorded in APP.DECISIONS; the underwriter decides</span>}>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ai text-xs inline-flex items-center gap-1" onClick={draft}><Mail className="w-3.5 h-3.5" aria-hidden />Request info (AI-drafted email)</button>
        <button className="btn text-xs inline-flex items-center gap-1" onClick={() => setMode('decline')}><ThumbsDown className="w-3.5 h-3.5" aria-hidden />Decline with reason</button>
        <button className="btn btn-primary text-xs inline-flex items-center gap-1" onClick={() => setMode('quote')}><ArrowRight className="w-3.5 h-3.5" aria-hidden />Move to quote</button>
      </div>

      {mode === 'info' && (
        <div className="mt-3">
          {email.busy ? <Reasoning kind="email" /> : email.error ? <ErrorNote error={email.error} /> : email.a && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">{email.a.source === 'mock' ? <SampleAiBadge /> : <SourceBadge p={email.a} />}<PoweredBy>AI_COMPLETE</PoweredBy></div>
              <label className="text-xs muted" htmlFor="email-draft">Edit before sending</label>
              <textarea id="email-draft" className="w-full mt-1 rounded-lg border p-3 text-sm min-h-[180px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                value={email.text} onChange={(e) => setEmail({ ...email, text: e.target.value })} />
              <button className="btn btn-primary text-xs mt-2 inline-flex items-center gap-1" disabled={saving} onClick={() => save('REQUEST_INFO', (email.text ?? '').slice(0, 1900))}><Send className="w-3.5 h-3.5" aria-hidden />Record request</button>
              <span className="text-[11px] muted ml-2">This example records the request; it does not send email.</span>
            </>
          )}
        </div>
      )}
      {mode === 'decline' && (
        <div className="mt-3 flex flex-wrap gap-2 items-end">
          <label className="text-xs">Reason<br /><select className="btn text-xs mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>{DECLINE_REASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-xs flex-1 min-w-[200px]">Note<br /><input className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.row.reasons[0] ?? ''} /></label>
          <button className="btn text-xs" disabled={saving} onClick={() => save('DECLINE', `${reason}${note ? `: ${note}` : d.row.reasons[0] ? `: ${d.row.reasons[0]}` : ''}`)}>Record decline</button>
        </div>
      )}
      {mode === 'quote' && (
        <div className="mt-3 text-sm">
          {d.row.appetite !== 'IN' && <p className="mb-2" style={{ color: 'var(--warning)' }}>This submission has referral or decline reasons. Moving it to quote should follow a referral sign-off.</p>}
          <button className="btn btn-primary text-xs" disabled={saving} onClick={() => save('QUOTE', `Fit ${Math.round(d.row.fit)}; ${d.row.appetite}`)}>Confirm move to quote</button>
        </div>
      )}
      {error && <div className="mt-2"><ErrorNote error={error} /></div>}
      {d.decisions.length > 0 && (
        <ul className="mt-3 text-xs space-y-1">{d.decisions.map((x, i) => <li key={i}><strong>{LABEL[x.decision] ?? x.decision}</strong> · {new Date(x.at).toLocaleString()} · {x.by}<div className="muted line-clamp-2">{x.reason}</div></li>)}</ul>
      )}
    </Card>
  );
}
