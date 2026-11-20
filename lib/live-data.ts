// Live mode: every screen reads the objects that sql/setup.sql builds. Server only.
// All values go through bind variables; nothing user-supplied is concatenated into SQL.
import { query, ROLE } from './snowflake';
import type { AiText, AskAnswer, Box, Detail, ExtractedField, GuideHit, Location, Portfolio, Queue, QueueRow, UwData } from './types';

type Row = Record<string, unknown>;
const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
const AGENT = process.env.SNOWFLAKE_AGENT_NAME ?? 'UNDERWRITING_SUBMISSION_DEMO.UW.SUBMISSION_ASSISTANT';
const SEARCH = 'UNDERWRITING_SUBMISSION_DEMO.UW.APPETITE_SEARCH';

const num = (x: unknown) => (x === null || x === undefined ? 0 : Number(x));
const parse = <T,>(x: unknown): T => (typeof x === 'string' ? JSON.parse(x) : x) as T;
const ts = (x: unknown) => (x instanceof Date ? x.toISOString() : new Date(String(x).replace(' ', 'T') + (String(x).endsWith('Z') ? '' : 'Z')).toISOString());

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const r = await fn();
  return [r, Date.now() - t0];
}

const FIELDS: [string, string][] = [
  ['insured_name', 'Named insured'], ['mailing_address', 'Mailing address'], ['broker', 'Broker'], ['effective_date', 'Effective date'],
  ['declared_business_type', 'Declared business type'], ['years_in_business', 'Years in business'], ['annual_revenue', 'Annual revenue'],
  ['employees', 'Employees'], ['requested_limit', 'Requested limit'], ['deductible', 'Deductible'], ['location_count', 'Locations'], ['total_tiv', 'Total insured value'],
];

function toRow(r: Row): QueueRow {
  return {
    id: String(r.SUBMISSION_ID), insured: String(r.INSURED_NAME), city: String(r.CITY), state: String(r.STATE), receivedAt: ts(r.RECEIVED_AT),
    daysWaiting: num(r.DAYS_WAITING), fifo: num(r.FIFO_POSITION), declaredClass: String(r.DECLARED_CLASS), predictedClass: String(r.PREDICTED_CLASS),
    className: String(r.CLASS_NAME ?? '').trim(), tiv: num(r.TOTAL_TIV), broker: String(r.BROKER_NAME), brokerTier: String(r.BROKER_TIER),
    appetite: String(r.APPETITE) as QueueRow['appetite'], reasons: parse<string[]>(r.APPETITE_REASONS) ?? [], missing: parse<string[]>(r.MISSING_ITEMS) ?? [],
    fit: num(r.FIT_SCORE),
    pts: { appetite: num(r.PTS_APPETITE), completeness: num(r.PTS_COMPLETENESS), broker: num(r.PTS_BROKER), loss: num(r.PTS_LOSS), concentration: num(r.PTS_CONCENTRATION) },
  };
}

const toLoc = (l: Row): Location => ({
  loc: num(l.LOC_NO), street: String(l.STREET), city: String(l.CITY), state: String(l.STATE), lat: num(l.LATITUDE), lon: num(l.LONGITUDE),
  construction: String(l.CONSTRUCTION), yearBuilt: num(l.YEAR_BUILT), sprinklered: String(l.SPRINKLERED), tiv: num(l.TIV),
  kmToCoast: num(l.KM_TO_COAST), coastal: l.IS_COASTAL === true || l.IS_COASTAL === 'true', nearbyPolicies: num(l.NEARBY_POLICIES), nearbyTiv: num(l.NEARBY_TIV),
});

async function searchGuide(q: string, limit = 4): Promise<GuideHit[]> {
  const rows = await query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(?, ?) AS R',
    [SEARCH, JSON.stringify({ query: q, columns: ['rule_id', 'section', 'appetite', 'guidance_text'], limit })]);
  const res = parse<{ results: Row[] }>(rows[0].R).results ?? [];
  return res.map((h) => ({ ruleId: String(h.rule_id), section: String(h.section), appetite: String(h.appetite), text: String(h.guidance_text) }));
}

async function complete(id: string, kind: string, prompt: string, sources: string[]): Promise<AiText> {
  const [rows, latencyMs] = await timed(() => query<{ R: string }>(
    `SELECT AI_COMPLETE(model => ?, prompt => ?, model_parameters => {'temperature': 0.2, 'max_tokens': 900}) AS R`, [MODEL, prompt]));
  const text = String(rows[0].R).trim().replace(/^"|"$/g, '');
  await query('INSERT INTO APP.AI_DRAFTS (submission_id, kind, model, prompt, response, sources, latency_ms) SELECT ?, ?, ?, ?, ?, PARSE_JSON(?), ?',
    [id, kind, MODEL, prompt, text, JSON.stringify(sources), latencyMs]);
  return { text, model: MODEL, sources, source: 'snowflake', role: ROLE, latencyMs };
}

export const liveData: UwData = {
  async queue(): Promise<Queue> {
    const [[rows, byDay], latencyMs] = await timed(() => Promise.all([
      query<Row>('SELECT * FROM UW.SUBMISSION_SCORES ORDER BY fit_score DESC, received_at'),
      query<Row>(`SELECT TO_CHAR(DATE(received_at), 'YYYY-MM-DD') AS D, COUNT(*) AS N FROM UW.SUBMISSIONS
                  WHERE received_at >= DATEADD('day', -30, (SELECT business_date FROM UW.CONFIG)) GROUP BY 1 ORDER BY 1`),
    ]));
    const list = rows.map(toRow);
    return {
      rows: list,
      kpis: {
        open: list.length, avgDays: +(list.reduce((s, r) => s + r.daysWaiting, 0) / Math.max(1, list.length)).toFixed(1),
        inAppetitePct: Math.round((100 * list.filter((r) => r.appetite === 'IN').length) / Math.max(1, list.length)),
        incomplete: list.filter((r) => r.missing.length).length, out: list.filter((r) => r.appetite === 'OUT').length, tiv: list.reduce((s, r) => s + r.tiv, 0),
      },
      byDay: byDay.map((d) => ({ date: String(d.D), count: num(d.N) })),
      source: 'snowflake', role: ROLE, latencyMs,
    };
  },

  async detail(id): Promise<Detail | null> {
    const [res, latencyMs] = await timed(async () => {
      const [score, ext, text, losses, locs, email, decisions] = await Promise.all([
        query<Row>('SELECT * FROM UW.SUBMISSION_SCORES WHERE submission_id = ?', [id]),
        query<Row>('SELECT result FROM UW.APP_EXTRACT WHERE submission_id = ?', [id]),
        query<Row>('SELECT LENGTH(content) AS N FROM UW.DOC_TEXT WHERE submission_id = ?', [id]),
        query<Row>('SELECT * FROM UW.LOSS_RUNS WHERE submission_id = ? ORDER BY policy_year', [id]),
        query<Row>('SELECT * FROM UW.LOCATION_EXPOSURE WHERE submission_id = ? ORDER BY loc_no', [id]),
        query<Row>('SELECT * FROM UW.BROKER_EMAILS WHERE submission_id = ?', [id]),
        query<Row>('SELECT * FROM APP.DECISIONS WHERE submission_id = ? ORDER BY decided_at DESC', [id]),
      ]);
      if (!score.length) return null;
      const row = toRow(score[0]);
      const r = parse<{ response: Row; citations?: { bounding_boxes?: Record<string, { page: number; upper_left: [number, number]; lower_right: [number, number] }[]> } }>(ext[0]?.RESULT ?? '{"response":{}}');
      const bb = r.citations?.bounding_boxes ?? {};
      const fields: ExtractedField[] = FIELDS.map(([key, label]) => ({
        key, label, value: String(r.response?.[key] ?? ''),
        boxes: (bb[key] ?? []).map((b): Box => ({ page: b.page, upperLeft: b.upper_left, lowerRight: b.lower_right })),
      }));
      const guide = await searchGuide(`${row.className} class ${row.predictedClass} appetite in ${row.state}${row.reasons.some((x) => /coast/i.test(x)) ? ' coastal locations accumulation' : ''}${row.missing.length ? ' missing loss runs completeness' : ''}`);
      const e = email[0] ?? {};
      return {
        row, fields, operations: String(r.response?.operations ?? ''), parsedChars: num(text[0]?.N),
        losses: row.missing.includes('Loss runs (5 years)') ? null : losses.map((l) => ({ year: num(l.POLICY_YEAR), carrier: String(l.CARRIER), claims: num(l.CLAIMS), incurred: num(l.INCURRED), paid: num(l.PAID), open: num(l.OPEN_CLAIMS), largest: String(l.LARGEST_LOSS) })),
        locations: locs.map(toLoc),
        email: { from: String(e.FROM_NAME ?? ''), subject: String(e.SUBJECT ?? ''), body: String(e.BODY ?? ''), sentAt: e.SENT_AT ? ts(e.SENT_AT) : '' },
        guide,
        decisions: decisions.map((d) => ({ decision: String(d.DECISION), reason: String(d.REASON), at: ts(d.DECIDED_AT), by: 'you (USI_DEMO_ROLE)' })),
      };
    });
    return res && { ...res, source: 'snowflake', role: ROLE, latencyMs };
  },

  async portfolio(id): Promise<Portfolio | null> {
    const [res, latencyMs] = await timed(async () => {
      const [cells, coast, locs, tot] = await Promise.all([
        query<Row>('SELECT lat, lon, tiv, locations FROM UW.PORTFOLIO_CELLS'),
        query<Row>('SELECT latitude, longitude FROM UW.COASTLINE_POINTS ORDER BY point_id'),
        query<Row>('SELECT * FROM UW.LOCATION_EXPOSURE WHERE submission_id = ? ORDER BY loc_no', [id]),
        query<Row>(`WITH p AS (
            SELECT e.tiv, e.state, MIN(ST_DISTANCE(ST_MAKEPOINT(e.longitude, e.latitude), ST_MAKEPOINT(c.longitude, c.latitude))) / 1000 AS km
            FROM UW.PORTFOLIO_EXPOSURE e CROSS JOIN UW.COASTLINE_POINTS c GROUP BY e.policy_id, e.loc_no, e.tiv, e.state)
          SELECT SUM(tiv) AS PORTFOLIO_TIV, SUM(IFF(km <= 16 AND state IN ('FL','TX','LA'), tiv, 0)) AS COASTAL_TIV FROM p`),
      ]);
      if (!locs.length) return null;
      const L = locs.map(toLoc);
      const portfolioTiv = num(tot[0].PORTFOLIO_TIV), coastalTiv = num(tot[0].COASTAL_TIV);
      const submissionTiv = L.reduce((s, l) => s + l.tiv, 0), submissionCoastalTiv = L.filter((l) => l.coastal).reduce((s, l) => s + l.tiv, 0);
      return {
        cells: cells.map((c) => ({ lat: num(c.LAT), lon: num(c.LON), tiv: num(c.TIV), locations: num(c.LOCATIONS) })),
        coast: coast.map((c) => [num(c.LATITUDE), num(c.LONGITUDE)] as [number, number]),
        locations: L,
        totals: {
          portfolioTiv, coastalTiv, nearbyTiv: L.reduce((s, l) => s + (l.coastal ? l.nearbyTiv : 0), 0), submissionTiv, submissionCoastalTiv,
          zoneShareBefore: +(100 * coastalTiv / portfolioTiv).toFixed(1), zoneShareAfter: +(100 * (coastalTiv + submissionCoastalTiv) / (portfolioTiv + submissionTiv)).toFixed(1),
        },
      };
    });
    return res && { ...res, source: 'snowflake', role: ROLE, latencyMs };
  },

  async memo(id) {
    const d = await liveData.detail(id);
    if (!d) throw new Error('Submission not found');
    const facts = {
      insured: d.row.insured, location: `${d.row.city}, ${d.row.state}`, governing_class: `${d.row.predictedClass} ${d.row.className}`, declared_class: d.row.declaredClass,
      operations: d.operations, total_tiv: d.row.tiv, appetite: d.row.appetite, appetite_reasons: d.row.reasons, missing_items: d.row.missing,
      broker: `${d.row.broker} (${d.row.brokerTier})`, fit_score: d.row.fit, loss_history: d.losses ?? 'Loss runs not received',
      locations: d.locations.map((l) => ({ city: l.city, tiv: l.tiv, km_to_coast: l.kmToCoast, coastal: l.coastal, portfolio_tiv_within_25km: l.nearbyTiv })),
      appetite_guide: d.guide.map((g) => `${g.ruleId} ${g.section}: ${g.text}`),
    };
    return complete(id, 'memo',
      'You are drafting an underwriting memo for a commercial property and casualty underwriter to review. Use only the facts provided. ' +
      'Write under 220 words in markdown with these bold headings: **Risk summary**, **Appetite and referral**, **Loss history**, **Exposure and concentration**, **Recommendation**. ' +
      'Cite appetite guide rule IDs (like AG-013) where they apply. The recommendation is a suggestion for the underwriter, not a decision.\n\nFacts:\n' + JSON.stringify(facts),
      ['AI_COMPLETE', 'Cortex Search: APPETITE_SEARCH', 'AI_EXTRACT fields', 'SUBMISSION_SCORES']);
  },

  async brokerEmail(id) {
    const d = await liveData.detail(id);
    if (!d) throw new Error('Submission not found');
    const facts = { insured: d.row.insured, broker_contact: d.email.from, broker_firm: d.row.broker, missing_items: d.row.missing, appetite: d.row.appetite, appetite_reasons: d.row.reasons, broker_note: d.email.body };
    return complete(id, 'broker_email',
      'Draft a short, friendly email from a commercial underwriter to the broker. If items are missing, request them specifically and explain they are needed before a quote. ' +
      'Decline only when appetite is OUT: then decline politely, give the reason in plain terms, and suggest the broker try a specialty market. Do not name any real insurer, broker or company; refer to a specialty market generically. If appetite is IN or REFER, never decline: request the missing items and, for REFER, list the questions the underwriter needs answered before a referral. ' +
      'Under 150 words. Start with "Subject:" on the first line. Sign as "[Underwriter name]". Use only these facts:\n' + JSON.stringify(facts),
      ['AI_COMPLETE', 'SUBMISSION_SCORES', 'BROKER_EMAILS']);
  },

  async decide(id, decision, reason) {
    await query('INSERT INTO APP.DECISIONS (submission_id, decision, reason) SELECT ?, ?, ?', [id, decision, reason]);
    return { ok: true, source: 'snowflake', role: ROLE };
  },

  async ask(question): Promise<AskAnswer> {
    const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: question }] }] });
    const [rows, latencyMs] = await timed(() => query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?, TRUE)::VARCHAR AS R', [AGENT, body]));
    const resp = JSON.parse(rows[0].R);
    const content: Row[] = resp.content ?? [];
    const text = content.filter((c) => c.type === 'text').map((c) => String(c.text)).join('\n').trim();
    let sql: string | undefined, columns: string[] | undefined, out: (string | number | null)[][] | undefined;
    const sources = new Set<string>();
    for (const c of content) {
      const tr = c.tool_result as Row | undefined, tu = c.tool_use as Row | undefined;
      if (tu?.name) sources.add(String(tu.name));
      if (!tr) continue;
      for (const part of (tr.content as Row[] | undefined) ?? []) {
        const j = part.json as Row | undefined;
        if (!j) continue;
        if (j.sql) sql = String(j.sql);
        const rs = j.result_set as { resultSetMetaData?: { rowType?: { name: string }[] }; data?: (string | null)[][] } | undefined;
        if (rs?.data) { columns = rs.resultSetMetaData?.rowType?.map((x) => x.name); out = rs.data.slice(0, 50); }
      }
    }
    return { text: text || '(No text in agent response.)', sql, columns, rows: out, sources: [...sources].map((s) => (s === 'submissions' ? 'Cortex Analyst: SUBMISSIONS_SV' : s === 'appetite_guide' ? 'Cortex Search: APPETITE_SEARCH' : s === 'system_execute_sql' ? 'SQL on USI_WH' : s)), source: 'snowflake', role: ROLE, latencyMs };
  },
};
