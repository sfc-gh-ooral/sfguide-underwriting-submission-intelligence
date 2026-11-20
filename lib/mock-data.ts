// No-account implementation of UwData. Runs in the browser, both in `npm run dev` Sample mode
// and in the static /try/ export. It serves results captured from a Live run of sql/setup.sql
// (scripts/capture-sample.mjs), so the numbers and AI text match what Snowflake produced.
// AI outputs are labeled "Sample AI response" in the UI and wait about as long as a real call.
import { SAMPLE_DELAY_BOUNDS_MS, SAMPLE_DELAY_MS } from './sample-timing';
import type { AiText, AskAnswer, Decision, Detail, Portfolio, Queue, Recheck, UwData } from './types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DECISIONS_KEY = 'quorvane-sample-decisions';
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
// AI surfaces: same jitter, kept within 4-8 s.
const thinkAi = (ms: number) => new Promise((r) => setTimeout(r, Math.min(SAMPLE_DELAY_BOUNDS_MS.max, Math.max(SAMPLE_DELAY_BOUNDS_MS.min, ms * (0.85 + Math.random() * 0.3)))));
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
    const [a] = await Promise.all([get<AiText>(`ai/${id}-memo.json`), thinkAi(SAMPLE_DELAY_MS.memo)]);
    return mock(a);
  },
  async brokerEmail(id) {
    const [a] = await Promise.all([get<AiText>(`ai/${id}-email.json`), thinkAi(SAMPLE_DELAY_MS.email)]);
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
    const [answers] = await Promise.all([get<(AskAnswer & { question: string })[]>('ask.json'), thinkAi(SAMPLE_DELAY_MS.ask)]);
    const hit = answers.find((a) => normalize(a.question) === normalize(question));
    if (hit) return mock(hit);
    return { source: 'mock', sources: [], text: 'This hosted example only has recorded answers for the suggested questions. Pick one of them, or run the app in Live mode to ask anything: the Cortex Agent writes SQL with Cortex Analyst on the SUBMISSIONS_SV semantic view.' };
  },
  // Simulated: replays the stored results that setup produced (no AI runs in Sample mode).
  async recheck(id): Promise<Recheck | null> {
    const [d] = await Promise.all([get<Detail>(`sub/${id}.json`).catch(() => null), thinkAi(SAMPLE_DELAY_MS.recheck)]);
    if (!d) return null;
    const pick = ['declared_business_type', 'location_count', 'total_tiv'];
    return {
      source: 'mock', parsedChars: d.parsedChars, storedParsedChars: d.parsedChars,
      fields: [...d.fields.filter((f) => pick.includes(f.key)).map((f) => ({ key: f.key, label: f.label, value: f.value, stored: f.value })),
        { key: 'operations', label: 'Nature of operations', value: d.operations, stored: d.operations }],
      predictedClass: d.row.predictedClass, storedClass: d.row.predictedClass, declaredClass: d.row.declaredClass,
      appetite: d.row.appetite, className: d.row.className, maxTiv: null,
      locations: d.locations.map((l) => ({ loc: l.loc, city: l.city, state: l.state, nearbyPolicies: l.nearbyPolicies, nearbyTiv: l.nearbyTiv, storedNearbyTiv: l.nearbyTiv })),
    };
  },
};
