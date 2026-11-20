'use client';

// Submission file: the broker documents with AI_EXTRACT source highlights, extracted fields, the
// appetite check with Cortex Search passages, loss-run charts, the broker email, an AI_COMPLETE memo
// draft, and the underwriter's decision (request info, decline, or move to quote) in a sticky rail.
import { ArrowRight, Check, ChevronLeft, FileText, Mail, MapPin, Send, Sparkles, ThumbsDown } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiDraft, Reasoning } from '@/components/Reasoning';
import { DEFAULT_SUBMISSION, rememberSubmission } from '@/components/Shell';
import { AppetitePill, CompletenessPill, Empty, ErrorNote, FitMeter, PageSkeleton, Panel, PoweredBy, SourceBadge, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { AiText, Detail } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DECLINE_REASONS = ['Class outside appetite', 'Territory outside appetite', 'Exceeds capacity or TIV limits', 'Loss history', 'Incomplete submission', 'Other'];
const LABEL: Record<string, string> = { REQUEST_INFO: 'Requested information', DECLINE: 'Declined', QUOTE: 'Moved to quote' };
const TIP = { background: 'var(--sheet)', border: '1px solid var(--rule)', borderRadius: 8, fontSize: 12, color: 'var(--ink)' };

export default function Page() {
  return <Suspense fallback={<PageSkeleton label="Loading submission" />}><SubmissionFile /></Suspense>;
}

function SubmissionFile() {
  const id = useSearchParams().get('id') ?? DEFAULT_SUBMISSION;
  useEffect(() => rememberSubmission(id), [id]);
  const [reload, setReload] = useState(0);
  const [kept, setKept] = useState<Detail>();
  const d = useAsync(() => data.detail(id), [id, reload]);
  useEffect(() => { if (d.data) setKept(d.data); }, [d.data]);
  const shown = d.data ?? (kept?.row.id === id ? kept : undefined); // keep the page on screen while a decision refreshes it
  if (d.error) return <ErrorNote error={d.error} />;
  if (!shown) return d.loading ? <PageSkeleton label="Loading submission" /> : <Empty title={`${id} is not on the open docket`}><Link className="underline" href="/">Back to the docket</Link></Empty>;
  return <FileView d={shown} onDecided={() => setReload((x) => x + 1)} />;
}

function FileView({ d, onDecided }: { d: Detail; onDecided: () => void }) {
  const r = d.row;
  const [doc, setDoc] = useState<'application' | 'loss_runs'>('application');
  const [focus, setFocus] = useState<string>('insured_name');
  const focused = d.fields.find((f) => f.key === focus) ?? d.fields[0];
  const tot = d.losses?.reduce((a, l) => ({ c: a.c + l.claims, i: a.i + l.incurred, o: a.o + l.open }), { c: 0, i: 0, o: 0 });
  const reclass = r.predictedClass !== r.declaredClass;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--ink-3)' }}><ChevronLeft className="w-3.5 h-3.5" aria-hidden />Docket</Link>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <div className="min-w-0">
            <div className="label"><span className="num">{r.id}</span> · received {r.receivedAt.slice(0, 10)} · waiting {r.daysWaiting} days · FIFO #{r.fifo}</div>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{r.insured}</h1>
            <div className="text-sm" style={{ color: 'var(--ink-2)' }}>{r.city}, {r.state} · {r.className} · <span className="num">{money(r.tiv)}</span> TIV · {d.locations.length} locations · {r.broker} ({r.brokerTier})</div>
          </div>
          <div className="flex flex-wrap gap-2"><AppetitePill a={r.appetite} /><CompletenessPill missing={r.missing} /><SourceBadge p={d} /></div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel kicker="Broker documents" title={<span className="inline-flex items-center gap-2"><FileText className="w-4 h-4" aria-hidden />{doc === 'application' ? 'Commercial application' : 'Five-year loss run'}</span>}
              right={<div className="seg" role="group" aria-label="Document">
                <button aria-pressed={doc === 'application'} onClick={() => setDoc('application')}>Application</button>
                <button aria-pressed={doc === 'loss_runs'} onClick={() => setDoc('loss_runs')} disabled={!d.losses} title={d.losses ? undefined : 'No loss run in this submission'}>Loss runs</button></div>}>
              <div className="inset p-3">
                <div className="relative mx-auto max-w-[520px] rounded-md overflow-hidden shadow-sm" style={{ background: '#fff' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}/docs/${r.id}_${doc}.svg`} alt={`${doc === 'application' ? 'Application' : 'Loss run'} page for ${r.insured}${doc === 'application' && focused ? `, with the ${focused.label} field highlighted` : ''}`} className="w-full block" />
                  {doc === 'application' && focused?.boxes.map((b, i) => (
                    <div key={`${focus}-${i}`} className="absolute rounded-sm pointer-events-none fade-in" aria-hidden
                      style={{ left: `${b.upperLeft[0]}%`, top: `${b.upperLeft[1]}%`, width: `${b.lowerRight[0] - b.upperLeft[0]}%`, height: `${b.lowerRight[1] - b.upperLeft[1]}%`, background: 'rgba(224,163,58,.30)', outline: '2px solid #C8861A' }} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}><span className="num">{d.parsedChars.toLocaleString()}</span> characters parsed (OCR mode). Pick a field to see its source.</span>
                <PoweredBy>AI_PARSE_DOCUMENT</PoweredBy>
              </div>
            </Panel>

            <Panel kicker="Extraction" title="What the submission says" right={<PoweredBy>AI_EXTRACT citations</PoweredBy>}>
              <div className="grid sm:grid-cols-2 gap-2">
                {d.fields.map((f) => (
                  <button key={f.key} onClick={() => { setFocus(f.key); setDoc('application'); }} aria-pressed={focus === f.key}
                    className="text-left rounded-lg border px-3 py-2 transition-colors hover:border-[var(--ink-3)]"
                    style={{ borderColor: focus === f.key ? 'var(--saffron)' : 'var(--rule)', background: focus === f.key ? 'color-mix(in srgb, var(--saffron) 10%, var(--sheet))' : 'var(--sheet)' }}>
                    <div className="label !text-[10.5px]">{f.label}</div>
                    <div className="text-[13px] font-medium break-words">{f.value || '—'}</div>
                  </button>))}
              </div>
              <div className="inset p-3 mt-3 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                <div className="label mb-1">Nature of operations</div>
                {d.operations}
                <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--rule)' }}>
                  <span>Governing class:</span><strong className="num" style={{ color: 'var(--ink)' }}>{r.predictedClass}</strong><span>{r.className}</span>
                  {reclass && <span className="pill pill-rust">Application declares {r.declaredClass}</span>}
                  <span className="ml-auto"><PoweredBy>AI_CLASSIFY</PoweredBy></span>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel kicker="Appetite" title="Appetite and completeness check" right={<PoweredBy>Cortex Search</PoweredBy>}>
              {r.reasons.length ? <ul className="text-sm space-y-1.5 mb-3">{r.reasons.map((x) => <li key={x} className="flex gap-2"><span style={{ color: r.appetite === 'OUT' ? 'var(--rust)' : 'var(--amber)' }} aria-hidden>●</span>{x}</li>)}</ul>
                : <p className="text-sm mb-3 flex items-center gap-2"><Check className="w-4 h-4" style={{ color: 'var(--sea)' }} aria-hidden />No referral or decline reasons.</p>}
              {r.missing.length > 0 && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--amber) 11%, var(--sheet))', color: 'var(--amber)' }}><strong>Missing:</strong> {r.missing.join(', ')}</div>}
              <div className="label mb-1.5">Appetite guide passages retrieved</div>
              <ul className="space-y-2">{d.guide.map((g) => (
                <li key={g.ruleId} className="text-[12.5px] border-l-2 pl-3" style={{ borderColor: 'var(--saffron)' }}>
                  <div><strong className="num">{g.ruleId}</strong> · {g.section} <span className="pill pill-plain ml-1">{g.appetite}</span></div>
                  <div style={{ color: 'var(--ink-2)' }}>{g.text}</div></li>))}</ul>
            </Panel>

            <Panel kicker="Loss history" title="Five-year loss run" right={<PoweredBy>AI_EXTRACT table extraction</PoweredBy>}>
              {d.losses && tot ? (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[['Claims', tot.c.toString()], ['Incurred', money(tot.i)], ['Open', tot.o.toString()]].map(([a, b]) => <div key={a} className="inset px-3 py-2"><div className="label">{a}</div><div className="num text-lg font-semibold">{b}</div></div>)}
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={d.losses} margin={{ left: -8, right: 0, top: 4 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--rule)" vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="a" tickFormatter={(v: number) => money(v)} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="b" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} width={24} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v, n) => (n === 'Claims' ? v : money(Number(v)))} contentStyle={TIP} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                        <Bar yAxisId="a" dataKey="incurred" name="Incurred" fill="var(--saffron)" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="a" dataKey="paid" name="Paid" fill="var(--sea)" radius={[3, 3, 0, 0]} />
                        <Line yAxisId="b" dataKey="claims" name="Claims" stroke="var(--ink)" strokeWidth={1.6} dot={{ r: 2.5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>Largest: {d.losses.filter((l) => l.largest !== 'None').map((l) => `${l.year} ${l.largest}`).join(' · ') || 'none reported'}</div>
                </>
              ) : <div className="rounded-lg px-3 py-6 text-sm text-center" style={{ background: 'color-mix(in srgb, var(--amber) 11%, var(--sheet))', color: 'var(--amber)' }}><strong>No loss runs in this submission.</strong><br />Request five years of currently valued loss runs before quoting.</div>}
            </Panel>
          </div>

          <Memo id={r.id} />
        </div>

        <div className="space-y-4 xl:sticky xl:top-[68px]">
          <Panel kicker="Score" title="Fit for this desk">
            <div className="flex items-baseline gap-1"><span className="num text-[40px] font-semibold leading-none">{Math.round(r.fit)}</span><span className="text-sm" style={{ color: 'var(--ink-3)' }}>/ 100</span></div>
            <div className="mt-2"><FitMeter value={r.fit} wide /></div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-3 num">
              {([['Appetite', r.pts.appetite, 35], ['Completeness', r.pts.completeness, 20], ['Broker value', r.pts.broker, 25], ['Loss history', r.pts.loss, 15], ['Concentration', r.pts.concentration, 10]] as const).map(([a, v, m]) => (
                <div key={a} className="contents"><dt style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>{a}</dt><dd className="text-right">{v} / {m}</dd></div>))}
            </dl>
            {r.appetite === 'OUT' && <div className="text-xs mt-2" style={{ color: 'var(--rust)' }}>Capped at 15: out of appetite.</div>}
          </Panel>
          <Actions d={d} onDecided={onDecided} />
          <Panel kicker="Broker email" title={<span className="inline-flex items-center gap-2"><Mail className="w-4 h-4" aria-hidden />{d.email.subject}</span>}>
            <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{d.email.from} · {d.email.sentAt.slice(0, 10)}</div>
            <p className="text-[13px] mt-2 whitespace-pre-line" style={{ color: 'var(--ink-2)' }}>{d.email.body}</p>
            <Link href={`/portfolio/?id=${r.id}`} className="btn mt-3 w-full justify-center"><MapPin className="w-4 h-4" aria-hidden />Check portfolio fit ({d.locations.length} locations)</Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Memo({ id }: { id: string }) {
  const [state, setState] = useState<{ busy?: boolean; a?: AiText; error?: string }>({});
  const run = () => { setState({ busy: true }); data.memo(id).then((a) => setState({ a }), (e) => setState({ error: String(e.message ?? e) })); };
  return (
    <Panel kicker="AI draft" title={<span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: 'var(--ai)' }} aria-hidden />Underwriting memo</span>}
      right={<><PoweredBy>AI_COMPLETE + Cortex Search</PoweredBy><button className="btn btn-ai" onClick={run} disabled={state.busy}>{state.a ? 'Redraft memo' : 'Draft memo'}</button></>}>
      {state.busy ? <Reasoning kind="memo" /> : state.error ? <ErrorNote error={state.error} /> : state.a ? <AiDraft a={state.a} label="Draft for review" />
        : <div className="inset px-4 py-5 text-sm" style={{ color: 'var(--ink-2)' }}>Draft a memo from the extracted fields, loss run, appetite reasons, exposure and the retrieved guide passages. The underwriter reviews and edits it; it is not a decision.</div>}
    </Panel>
  );
}

function Actions({ d, onDecided }: { d: Detail; onDecided: () => void }) {
  const [mode, setMode] = useState<'none' | 'info' | 'decline' | 'quote'>('none');
  const [email, setEmail] = useState<{ busy?: boolean; a?: AiText; text?: string; error?: string }>({});
  const [reason, setReason] = useState(d.row.appetite === 'OUT' ? DECLINE_REASONS[0] : d.row.missing.length ? DECLINE_REASONS[4] : DECLINE_REASONS[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const draft = () => { setMode('info'); setEmail({ busy: true }); data.brokerEmail(d.row.id).then((a) => setEmail({ a, text: a.text }), (e) => setEmail({ error: String(e.message ?? e) })); };
  const save = async (decision: 'REQUEST_INFO' | 'DECLINE' | 'QUOTE', why: string) => {
    setSaving(true); setError(undefined);
    try { await data.decide(d.row.id, decision, why); setMode('none'); setNote(''); setSaved(LABEL[decision]); onDecided(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setSaving(false); }
  };

  return (
    <Panel kicker="Decision" title="Underwriter action" right={<span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Saved to APP.DECISIONS</span>}>
      <div className="grid gap-2">
        <button className="btn btn-ai justify-center" onClick={draft}><Mail className="w-4 h-4" aria-hidden />Request info (AI-drafted email)</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-danger justify-center" onClick={() => setMode('decline')}><ThumbsDown className="w-4 h-4" aria-hidden />Decline</button>
          <button className="btn btn-primary justify-center" onClick={() => setMode('quote')}><ArrowRight className="w-4 h-4" aria-hidden />Move to quote</button>
        </div>
      </div>

      {mode === 'info' && (
        <div className="mt-3">
          {email.busy ? <Reasoning kind="email" /> : email.error ? <ErrorNote error={email.error} /> : email.a && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">{email.a.source === 'mock' ? <span className="pill pill-saffron">Sample AI response</span> : <SourceBadge p={email.a} />}<PoweredBy>AI_COMPLETE</PoweredBy></div>
              <label className="label" htmlFor="email-draft">Edit before sending</label>
              <textarea id="email-draft" className="field mt-1 min-h-[200px] text-[13px]" value={email.text} onChange={(e) => setEmail({ ...email, text: e.target.value })} />
              <button className="btn btn-primary mt-2" disabled={saving} onClick={() => save('REQUEST_INFO', (email.text ?? '').slice(0, 1900))}><Send className="w-4 h-4" aria-hidden />Record request</button>
              <p className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>This example records the request; it does not send email.</p>
            </>)}
        </div>)}
      {mode === 'decline' && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs"><span className="label">Reason</span><select className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>{DECLINE_REASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="block text-xs"><span className="label">Note</span><input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.row.reasons[0] ?? ''} /></label>
          <button className="btn btn-danger" disabled={saving} onClick={() => save('DECLINE', `${reason}${note ? `: ${note}` : d.row.reasons[0] ? `: ${d.row.reasons[0]}` : ''}`)}>Record decline</button>
        </div>)}
      {mode === 'quote' && (
        <div className="mt-3 text-sm">
          {d.row.appetite !== 'IN' && <p className="mb-2" style={{ color: 'var(--amber)' }}>This file has referral or decline reasons. Moving it to quote should follow a referral sign-off.</p>}
          <button className="btn btn-primary" disabled={saving} onClick={() => save('QUOTE', `Fit ${Math.round(d.row.fit)}; ${d.row.appetite}`)}>Confirm move to quote</button>
        </div>)}
      {saved && mode === 'none' && <div className="mt-3 text-sm flex items-center gap-2 fade-in" role="status" style={{ color: 'var(--sea)' }}><Check className="w-4 h-4" aria-hidden />{saved} recorded.</div>}
      {error && <div className="mt-2"><ErrorNote error={error} /></div>}
      {d.decisions.length > 0 && (
        <ol className="mt-3 pt-3 border-t space-y-2 text-xs" style={{ borderColor: 'var(--rule)' }}>
          {d.decisions.map((x, i) => <li key={i} className="border-l-2 pl-2" style={{ borderColor: x.decision === 'DECLINE' ? 'var(--rust)' : x.decision === 'QUOTE' ? 'var(--sea)' : 'var(--ai)' }}>
            <strong>{LABEL[x.decision] ?? x.decision}</strong> · {new Date(x.at).toLocaleString()} · {x.by}<div className="line-clamp-2" style={{ color: 'var(--ink-3)' }}>{x.reason}</div></li>)}
        </ol>)}
    </Panel>
  );
}
