// Captures Sample-mode data from a running Live dev server (npm run dev with .env.local), so the
// no-account example shows the numbers, extraction results, and AI text Snowflake produced.
//   node scripts/capture-sample.mjs [http://localhost:3000] [--resume]
// Writes public/mock/. Re-run after changing sql/setup.sql. Uses the pack role only.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:3000';
const OUT = 'public/mock';
const ASK = [
  'Show restaurants in Florida with TIV over $5M submitted this month.',
  'Which brokers sent the most out-of-appetite submissions?',
  'What is the average fit score by class code?',
  'What does the appetite guide say about coastal locations?',
];

async function call(op, ...args) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}/api/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
    const json = await res.json();
    if (res.ok) return json;
    if (attempt >= 3) throw new Error(`${op}(${args.join(', ')}): ${json.error}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}
const strip = (x) => { const { source, role, ...rest } = x; return { ...rest, source: 'mock' }; };
const write = (path, obj) => writeFileSync(`${OUT}/${path}`, JSON.stringify(obj));
async function pool(items, n, fn) {
  const queue = [...items]; let done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) { const it = queue.shift(); await fn(it); if (++done % 25 === 0) console.log(`  ${done}/${items.length}`); }
  }));
}

const RESUME = process.argv.includes('--resume'); // keep AI drafts already captured
if (!RESUME) rmSync(OUT, { recursive: true, force: true });
for (const d of ['sub', 'portfolio', 'ai']) mkdirSync(`${OUT}/${d}`, { recursive: true });
const timings = { memo: [], email: [], ask: [] };

const queue = await call('queue');
write('queue.json', strip(queue));
const ids = queue.rows.map((r) => r.id);
console.log(`queue: ${ids.length} submissions`);

let base;
await pool(ids, 6, async (id) => {
  const d = await call('detail', id);
  write(`sub/${id}.json`, { ...strip(d), decisions: [] });
  const p = await call('portfolio', id);
  if (!base) { base = { cells: p.cells, coast: p.coast }; write('portfolio.json', base); }
  write(`portfolio/${id}.json`, { locations: p.locations, totals: p.totals });
});
console.log('details and portfolio captured');

await pool(ids, 6, async (id) => {
  if (RESUME && existsSync(`${OUT}/ai/${id}-email.json`)) return;
  const m = await call('memo', id); timings.memo.push(m.latencyMs); write(`ai/${id}-memo.json`, strip(m));
  const e = await call('brokerEmail', id); timings.email.push(e.latencyMs); write(`ai/${id}-email.json`, strip(e));
});
console.log('memos and broker emails captured');

const answers = [];
for (const q of ASK) { const a = await call('ask', q); timings.ask.push(a.latencyMs); answers.push({ question: q, ...strip(a) }); }
write('ask.json', answers);

const stat = (a) => { if (!a.length) return {}; const s = [...a].sort((x, y) => x - y); return { n: s.length, median: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1] }; };
console.log('Live AI latency (ms):', JSON.stringify({ memo: stat(timings.memo), email: stat(timings.email), ask: stat(timings.ask) }));
