// No-account implementation of UwData. Runs in the browser, both in `npm run dev` Sample mode
// and in the static /try/ export. It serves results captured from a Live run of sql/setup.sql
// (scripts/capture-sample.mjs), so the numbers and AI text match what Snowflake produced.
// AI outputs are labeled "Sample AI response" in the UI and wait about as long as a real call.
import { SAMPLE_DELAY_MS } from './sample-timing';
import type { AiText, AskAnswer, Decision, Detail, Portfolio, Queue, UwData } from './types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DECISIONS_KEY = 'usi-sample-decisions';
const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/mock/${path}`).then((r) => { if (!r.ok) throw new Error(`Sample file missing: ${path}`); return r.json() as Promise<T>; });
    cache.set(path, p); p.catch(() => cache.delete(path));
  }
  return p;
}
const think = (ms: number) => new Promise((r) => setTimeout(r, ms * (0.85 + Math.random() * 0.3)));
const mock = <T extends object>(x: T): T => ({ ...x, source: 'mock', latencyMs: undefined });

function localDecisions(): Record<string, Decision[]> {
  try { return JSON.parse(window.localStorage.getItem(DECISIONS_KEY) ?? '{}'); } catch { return {}; }
}

function normalize(q: string) { return q.toLowerCase().replace(/[^a-z0-9$ ]/g, '').replace(/\s+/g, ' ').trim(); }

export const mockData: UwData = {
  async queue() { return mock(await get<Queue>('queue.json')); },
  async detail(id) {
    const d = await get<Detail>(`sub/${id}.json`).catch(() => null);
    if (!d) return null;
    return mock({ ...d, decisions: [...(localDecisions()[id] ?? []), ...d.decisions] });
  },
  async portfolio(id) {
    const [base, locs] = await Promise.all([get<Omit<Portfolio, 'locations' | 'totals'>>('portfolio.json'), get<Pick<Portfolio, 'locations' | 'totals'>>(`portfolio/${id}.json`).catch(() => null)]);
    return locs ? mock({ ...base, ...locs }) : null;
  },
  async memo(id) {
    const [a] = await Promise.all([get<AiText>(`ai/${id}-memo.json`), think(SAMPLE_DELAY_MS.memo)]);
    return mock(a);
  },
  async brokerEmail(id) {
    const [a] = await Promise.all([get<AiText>(`ai/${id}-email.json`), think(SAMPLE_DELAY_MS.email)]);
    return mock(a);
  },
  async decide(id, decision, reason) {
    const all = localDecisions();
    all[id] = [{ decision, reason, at: new Date().toISOString(), by: 'you (sample)' }, ...(all[id] ?? [])];
    window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(all));
    await think(600);
    return { ok: true, source: 'mock' };
  },
  async ask(question) {
    const [answers] = await Promise.all([get<(AskAnswer & { question: string })[]>('ask.json'), think(SAMPLE_DELAY_MS.ask)]);
    const hit = answers.find((a) => normalize(a.question) === normalize(question));
    if (hit) return mock(hit);
    return { source: 'mock', sources: [], text: 'This hosted example only has recorded answers for the suggested questions. Pick one of them, or run the app in Live mode to ask anything: the Cortex Agent writes SQL with Cortex Analyst on the SUBMISSIONS_SV semantic view.' };
  },
};
