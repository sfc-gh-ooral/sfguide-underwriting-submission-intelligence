'use client';

// Staged progress for AI calls. The steps mirror what the live path actually does. Steps advance on a
// timer; the last one holds until the real (or sample) answer arrives.
import { BookOpen, Check, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Markdown, SampleAiBadge, SourceBadge } from '@/components/ui';
import type { AiText } from '@/lib/types';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = 'memo' | 'email' | 'ask' | 'recheck';

const STEPS: Record<ReasoningKind, string[]> = {
  memo: [
    'Reading AI_EXTRACT fields and loss run table',
    'Checking appetite rules and fit score components',
    'Searching the appetite guide with Cortex Search',
    'Drafting the memo with AI_COMPLETE',
    'Saving the draft to APP.AI_DRAFTS',
  ],
  email: [
    'Reading missing items and appetite reasons',
    'Reading the broker’s cover email',
    'Drafting the email with AI_COMPLETE',
    'Saving the draft to APP.AI_DRAFTS',
  ],
  ask: [
    'Planning with the Cortex Agent',
    'Generating SQL with Cortex Analyst on SUBMISSIONS_SV',
    'Running the query on QUORVANE_WH',
    'Composing the answer',
  ],
  recheck: [
    'Parsing the application with AI_PARSE_DOCUMENT (OCR mode)',
    'Extracting fields with AI_EXTRACT',
    'Checking proximity to the book with ST_DWITHIN (25 km)',
    'Classifying operations with AI_CLASSIFY',
    'Looking up the class in the appetite guide',
  ],
};


export function Reasoning({ kind }: { kind: ReasoningKind }) {
  const steps = STEPS[kind];
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, []);
  const per = SAMPLE_DELAY_MS[kind] / steps.length;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / per));
  return (
    <div className="inset p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--ai)' }}><Sparkles className="w-3.5 h-3.5" aria-hidden />{kind === 'recheck' ? 'Re-checking the submission' : 'Working on the draft'}</div>
        <span className="num text-[11px]" style={{ color: 'var(--ink-3)' }}>{(elapsed / 1000).toFixed(1)} s</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className="flex items-center gap-2.5 text-[13px]" style={{ color: state === 'todo' ? 'var(--ink-3)' : 'var(--ink)', opacity: state === 'todo' ? 0.7 : 1 }}>
              {state === 'done' ? <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--sea)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--ai)' }} aria-hidden />
                : <span className="w-4 h-4 shrink-0 rounded-full border" style={{ borderColor: 'var(--rule)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="progress-rule mt-3" aria-hidden><span style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%` }} /></div>
    </div>
  );
}

/** Reveals AI text word by word (about 1.5 s for a memo), then shows its sources. */
export function useReveal(text: string | undefined, ms = 1600) {
  const [n, setN] = useState(0);
  const words = text ? text.split(/(\s+)/) : [];
  useEffect(() => {
    if (!text) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(words.length); return; }
    setN(0);
    const t0 = Date.now();
    const id = window.setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); setN(Math.ceil(k * words.length)); if (k >= 1) window.clearInterval(id); }, 40);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return { shown: words.slice(0, n).join(''), done: n >= words.length };
}

export function Citations({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
      <span className="label mr-1">Sources</span>
      {sources.map((s, i) => <span key={s} className="pill pill-plain fade-in" style={{ animationDelay: `${i * 60}ms` }}><BookOpen className="w-3 h-3" aria-hidden />{s}</span>)}
    </div>
  );
}

export function AiDraft({ a, label }: { a: AiText; label?: string }) {
  const { shown, done } = useReveal(a.text);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {a.source === 'mock' ? <SampleAiBadge /> : <SourceBadge p={a} />}
        {label && <span className="pill pill-ai">{label}</span>}
        {a.model && <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Model: {a.model}</span>}
      </div>
      <div className={done ? '' : 'caret'}><Markdown text={shown} /></div>
      {done && <Citations sources={a.sources} />}
    </div>
  );
}
