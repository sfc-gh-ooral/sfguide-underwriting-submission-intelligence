// Deterministic synthetic data for Underwriting Submission Intelligence.
// Writes gzipped CSVs to data/csv/ and one PDF packet per submission to data/docs/.
// Same seed, same output: every company, broker, and number here is invented.
//   node scripts/generate-data.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

let seed = 20261118;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const round = (x, step) => Math.round(x / step) * step;
const jitter = (x, d) => +(x + (rnd() - 0.5) * 2 * d).toFixed(5);

const BUSINESS_DATE = new Date('2026-11-18T12:00:00Z');
const daysAgo = (n, h = 9) => { const d = new Date(BUSINESS_DATE); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(h, int(0, 59), 0, 0); return d; };
const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const ymd = (d) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
// Coined name stems so no generated firm matches a real one.
const BROKERS = [
  ['BRK01', 'Halvane Risk Partners', 'Top', 'Southeast'], ['BRK02', 'Corvessa Insurance Brokers', 'Top', 'Gulf'],
  ['BRK03', 'Tamberlin & Voss Wholesale', 'Top', 'National'], ['BRK04', 'Quillmark Commercial', 'Core', 'Southeast'],
  ['BRK05', 'Ostrava Bay Brokerage', 'Core', 'Gulf'], ['BRK06', 'Brindlecove Risk Services', 'Core', 'Mid-Atlantic'],
  ['BRK07', 'Pellivane Insurance Group', 'Core', 'Central'], ['BRK08', 'Wexmoor Agency', 'Core', 'Southwest'],
  ['BRK09', 'Sarvenna Specialty', 'Core', 'National'], ['BRK10', 'Dunmere Partners', 'Emerging', 'Southeast'],
  ['BRK11', 'Calvetti Insurance', 'Emerging', 'Gulf'], ['BRK12', 'Fenwray Brokers', 'Emerging', 'Central'],
  ['BRK13', 'Ivorcrest Risk', 'Emerging', 'Southwest'], ['BRK14', 'Marlowick Agency', 'Emerging', 'Mid-Atlantic'],
];
const BROKER_STATS = { Top: [[38e6, 62e6], [0.34, 0.46]], Core: [[9e6, 24e6], [0.2, 0.32]], Emerging: [[1.5e6, 6e6], [0.1, 0.22]] };

// Class codes: the appetite guide decides IN / REFER / OUT.
const CLASSES = [
  { code: 'REST', name: 'Restaurant (full service)', appetite: 'IN', maxTiv: 12e6, ops: ['operates a full-service restaurant with table seating and a bar under 30% of sales', 'runs casual dining restaurants serving lunch and dinner; alcohol sales are about 20% of receipts', 'operates family restaurants with on-site kitchens and catering for local events'] },
  { code: 'OFFC', name: 'Office / lessors risk', appetite: 'IN', maxTiv: 40e6, ops: ['owns and leases Class A and B office space to professional tenants', 'is a lessor of multi-tenant office buildings with no owner occupancy', 'owns a professional office park leased to medical and accounting tenants'] },
  { code: 'RETL', name: 'Retail store', appetite: 'IN', maxTiv: 15e6, ops: ['operates neighborhood retail stores selling home goods and apparel', 'runs specialty retail shops selling outdoor gear', 'operates hardware and garden retail locations'] },
  { code: 'APTS', name: 'Apartments / habitational', appetite: 'IN', maxTiv: 35e6, ops: ['owns garden-style apartment communities built after 2005', 'owns and manages mid-rise apartment buildings with on-site management'] },
  { code: 'MFGL', name: 'Light manufacturing', appetite: 'IN', maxTiv: 25e6, ops: ['manufactures custom cabinetry and millwork for builders', 'assembles electronic control panels for HVAC equipment', 'produces printed packaging and labels'] },
  { code: 'WHSE', name: 'Warehouse / distribution', appetite: 'IN', maxTiv: 30e6, ops: ['operates a distribution warehouse for packaged foods and paper goods', 'provides third-party warehousing of furniture and appliances', 'runs a regional distribution center for auto parts'] },
  { code: 'HOTL', name: 'Hotel / motel', appetite: 'REFER', maxTiv: 30e6, ops: ['operates limited-service hotels with no restaurant on premises', 'owns select-service hotels near business districts'] },
  { code: 'AUTO', name: 'Auto repair / service', appetite: 'REFER', maxTiv: 8e6, ops: ['operates auto repair garages performing brake, tire, and engine work', 'runs collision repair shops with paint booths'] },
  { code: 'CONT', name: 'Artisan contractor', appetite: 'REFER', maxTiv: 5e6, ops: ['is an electrical contractor working on commercial interiors', 'is a plumbing contractor for residential remodels'] },
  { code: 'FIRE', name: 'Fireworks / explosives', appetite: 'OUT', maxTiv: 0, ops: [] },
  { code: 'NITE', name: 'Nightclub / bar with entertainment', appetite: 'OUT', maxTiv: 0, ops: ['operates late-night bars with live entertainment and a dance floor'] },
  { code: 'ROOF', name: 'Roofing contractor', appetite: 'OUT', maxTiv: 0, ops: ['is a roofing contractor doing torch-down and hot tar work'] },
];
const CLASS = Object.fromEntries(CLASSES.map((c) => [c.code, c]));

const CITIES = [
  ['Miami', 'FL', 25.7617, -80.1918], ['Fort Lauderdale', 'FL', 26.1224, -80.1373], ['Tampa', 'FL', 27.9506, -82.4572],
  ['St. Petersburg', 'FL', 27.7676, -82.6403], ['Clearwater Beach', 'FL', 27.9770, -82.8270], ['Sarasota', 'FL', 27.3364, -82.5307],
  ['Naples', 'FL', 26.1420, -81.7948], ['Fort Myers', 'FL', 26.6406, -81.8723], ['Orlando', 'FL', 28.5383, -81.3792],
  ['Jacksonville', 'FL', 30.3322, -81.6557], ['Tallahassee', 'FL', 30.4383, -84.2807], ['Gainesville', 'FL', 29.6516, -82.3248],
  ['Houston', 'TX', 29.7604, -95.3698], ['Galveston', 'TX', 29.3013, -94.7977], ['Dallas', 'TX', 32.7767, -96.7970],
  ['Austin', 'TX', 30.2672, -97.7431], ['San Antonio', 'TX', 29.4241, -98.4936], ['Atlanta', 'GA', 33.7490, -84.3880],
  ['Savannah', 'GA', 32.0809, -81.0912], ['Charleston', 'SC', 32.7765, -79.9311], ['Charlotte', 'NC', 35.2271, -80.8431],
  ['Raleigh', 'NC', 35.7796, -78.6382], ['Nashville', 'TN', 36.1627, -86.7816], ['Birmingham', 'AL', 33.5186, -86.8104],
  ['New Orleans', 'LA', 29.9511, -90.0715], ['Phoenix', 'AZ', 33.4484, -112.0740], ['Denver', 'CO', 39.7392, -104.9903],
  ['Columbus', 'OH', 39.9612, -82.9988], ['Indianapolis', 'IN', 39.7684, -86.1581], ['Chicago', 'IL', 41.8781, -87.6298],
];
const CITY = Object.fromEntries(CITIES.map((c) => [c[0], c]));
const STREETS = ['Harbor', 'Oakline', 'Cypress', 'Meridian', 'Palmetto', 'Granite', 'Willow', 'Bayview', 'Commerce', 'Lakeshore', 'Founders', 'Kestrel'];
const SUFFIX = ['St', 'Ave', 'Blvd', 'Way', 'Pkwy', 'Dr'];

// Rough Gulf and Atlantic coastline used by the geospatial distance-to-coast check.
const COAST = [
  [27.80, -97.39], [28.60, -96.60], [29.30, -94.79], [29.55, -92.30], [29.20, -90.10], [30.35, -88.90], [30.25, -87.70],
  [30.39, -86.50], [30.15, -85.70], [29.70, -84.90], [30.00, -84.20], [29.20, -83.10], [28.60, -82.70], [27.97, -82.83],
  [27.70, -82.74], [27.30, -82.57], [26.95, -82.35], [26.60, -82.10], [26.15, -81.81], [25.85, -81.40], [25.15, -80.90],
  [24.56, -81.80], [25.30, -80.30], [25.78, -80.13], [26.12, -80.10], [26.70, -80.03], [27.20, -80.20], [27.80, -80.42],
  [28.40, -80.60], [29.20, -81.00], [29.90, -81.30], [30.40, -81.40], [31.20, -81.30], [32.03, -80.90], [32.75, -79.86],
  [33.70, -78.85], [34.20, -77.80], [35.20, -75.60], [36.85, -75.98],
];

const STEM_A = ['Brenvale', 'Corthan', 'Dalmora', 'Elsmere', 'Fairhallow', 'Gravelin', 'Hestor', 'Ironvale', 'Juniver', 'Kelridge', 'Lanmore', 'Marquette', 'Norvell', 'Ostrem', 'Pemberly', 'Quarrow', 'Rendale', 'Selwyn', 'Thornbury', 'Ulvara', 'Varnley', 'Westrow', 'Yarden', 'Zelvane', 'Ashcomb', 'Birchley', 'Calloway', 'Drummond', 'Everholt', 'Fenwick'];
const STEM_B = { REST: ['Bistro Group', 'Kitchen Co', 'Grill Holdings', 'Table & Tap'], OFFC: ['Office Partners', 'Realty Holdings', 'Plaza LLC'], RETL: ['Outfitters', 'Mercantile', 'Home & Garden'], APTS: ['Residential', 'Living Communities', 'Apartments LP'], MFGL: ['Fabrication', 'Manufacturing', 'Industries'], WHSE: ['Logistics', 'Distribution', 'Warehousing'], HOTL: ['Hospitality', 'Inns', 'Hotel Group'], AUTO: ['Auto Care', 'Motorworks'], CONT: ['Electric', 'Plumbing Services'], NITE: ['Lounge Group'], ROOF: ['Roofing'], FIRE: ['Pyrotechnics'] };
const CARRIERS = ['Prior: Arbelle Mutual', 'Prior: Keystrand Casualty', 'Prior: Lorvane Insurance Co', 'Prior: Strathmoor Indemnity'];
const CONSTRUCTION = ['Frame', 'Joisted masonry', 'Non-combustible', 'Masonry non-combustible', 'Fire resistive'];

// ---------------------------------------------------------------------------
// Brokers, appetite guide
// ---------------------------------------------------------------------------
const brokers = BROKERS.map(([id, name, tier, region]) => {
  const [[pl, ph], [hl, hh]] = BROKER_STATS[tier];
  return { broker_id: id, broker_name: name, tier, region, ytd_written_premium: round(pl + rnd() * (ph - pl), 1000), hit_ratio: +(hl + rnd() * (hh - hl)).toFixed(3) };
});

const appetite = [];
let r = 0;
for (const c of CLASSES) {
  const id = `AG-${String(++r).padStart(3, '0')}`;
  const text = c.appetite === 'IN'
    ? `${c.name} (class ${c.code}) is a target class. Write up to $${c.maxTiv / 1e6}M total insured value per account and $5M per occurrence limit. Prefer accounts with 3+ years in business and favorable 5-year loss history.`
    : c.appetite === 'REFER'
      ? `${c.name} (class ${c.code}) requires referral to a senior underwriter. Maximum $${c.maxTiv / 1e6}M TIV per account. Review fire protection, housekeeping, and prior losses before quoting.`
      : `${c.name} (class ${c.code}) is outside appetite. Decline politely and suggest the broker approach a specialty market. This includes any operations that manufacture, store, or sell ${c.code === 'FIRE' ? 'fireworks, explosives, or pyrotechnic products, even seasonally or as a minor share of sales' : c.code === 'NITE' ? 'alcohol with live entertainment after midnight' : 'roofing with open-flame or hot-tar methods'}.`;
  appetite.push({ rule_id: id, section: 'Classes', class_code: c.code, rule_type: 'CLASS', appetite: c.appetite, max_tiv: c.maxTiv, territory: '', guidance_text: text });
}
const TERR = [
  ['Territory: Florida and Texas coastal', 'FL,TX,LA', 'REFER', 15e6, 'Locations within 10 miles (16 km) of the Gulf or Atlantic coast in FL, TX, or LA are referred. Cap any single coastal location at $15M TIV. Refer accounts that add more than $25M TIV within 25 km of existing portfolio locations (coastal accumulation).'],
  ['Territory: Southeast and Central inland', 'FL,TX,GA,SC,NC,TN,AL,OH,IN,IL', 'IN', 0, 'Inland locations in the Southeast and Central states are in appetite subject to class rules.'],
  ['Territory: Mountain and Southwest', 'AZ,CO', 'IN', 0, 'Arizona and Colorado are in appetite. Wildfire-exposed locations require a defensible space report.'],
  ['Territory: Louisiana', 'LA', 'REFER', 10e6, 'Louisiana accounts are referred and capped at $10M total insured value.'],
  ['Completeness: required documents', '', 'IN', 0, 'A complete submission has an application, a statement of values with addresses and construction, and five years of currently valued loss runs. Request missing loss runs before quoting.'],
  ['Loss history', '', 'REFER', 0, 'Refer accounts with five-year incurred losses above 60% of the premium-equivalent benchmark, any single loss over $500K, or more than one open claim.'],
];
for (const [section, terr, app, max, text] of TERR) appetite.push({ rule_id: `AG-${String(++r).padStart(3, '0')}`, section, class_code: '', rule_type: section.startsWith('Territory') ? 'TERRITORY' : 'GENERAL', appetite: app, max_tiv: max, territory: terr, guidance_text: text });

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------
const submissions = [], locations = [], emails = [], lossTruth = [];
const usedNames = new Set();
const coined = (cls) => { let n; do n = `${pick(STEM_A)} ${pick(STEM_B[cls])}`; while (usedNames.has(n)); usedNames.add(n); return n; };
const address = () => `${int(100, 9800)} ${pick(STREETS)} ${pick(SUFFIX)}`;

const CLASS_MIX = ['REST', 'REST', 'REST', 'OFFC', 'OFFC', 'RETL', 'RETL', 'APTS', 'MFGL', 'WHSE', 'WHSE', 'HOTL', 'AUTO', 'CONT', 'NITE', 'ROOF'];
const FL_REST_CITIES = ['Miami', 'Tampa', 'Orlando', 'Fort Lauderdale', 'Jacksonville', 'Sarasota', 'Naples'];

function makeSubmission(i, o = {}) {
  const cls = o.cls ?? pick(CLASS_MIX);
  const c = CLASS[cls];
  const city = o.city ?? (cls === 'REST' && rnd() < 0.35 ? pick(FL_REST_CITIES) : pick(CITIES)[0]);
  const [, state] = CITY[city];
  const nLoc = o.nLoc ?? (cls === 'REST' || cls === 'RETL' ? int(1, 4) : int(1, 3));
  const id = `SUB-${String(1000 + i).padStart(4, '0')}`;
  const broker = o.broker ?? pick(brokers);
  const received = o.received ?? daysAgo(int(0, 34), int(7, 18));
  const years = o.years ?? int(2, 28);
  const revenue = round(o.revenue ?? (2e6 + rnd() * 38e6), 10000);
  const locs = [];
  for (let k = 0; k < nLoc; k++) {
    const lc = o.locCities?.[k] ?? (k === 0 ? city : rnd() < 0.7 ? city : pick(CITIES.filter((x) => x[1] === state))?.[0] ?? city);
    const [, st, la, lo] = CITY[lc];
    const tiv = o.locTiv?.[k] ?? round((cls === 'APTS' || cls === 'OFFC' || cls === 'WHSE' ? 3e6 + rnd() * 9e6 : 0.8e6 + rnd() * 3.6e6), 5000);
    const pt = o.locPoints?.[k] ?? [jitter(la, 0.06), jitter(lo, 0.06)];
    locs.push({ submission_id: id, loc_no: k + 1, street: address(), city: lc, state: st, latitude: pt[0], longitude: pt[1], construction: o.construction ?? pick(CONSTRUCTION), year_built: int(1972, 2021), stories: int(1, cls === 'OFFC' || cls === 'APTS' || cls === 'HOTL' ? 9 : 3), sprinklered: rnd() < 0.7 ? 'Y' : 'N', tiv });
  }
  const tiv = locs.reduce((s, l) => s + l.tiv, 0);
  const ops = o.ops ?? pick(c.ops);
  const name = o.name ?? coined(cls);
  const declared = o.declared ?? cls;
  const losses = o.losses ?? Array.from({ length: 5 }, (_, y) => {
    const n = rnd() < 0.55 ? 0 : int(1, 3);
    const incurred = n === 0 ? 0 : round(n * (8000 + rnd() * 60000), 100);
    return { year: 2021 + y, carrier: pick(CARRIERS).replace('Prior: ', ''), claims: n, incurred, paid: round(incurred * (0.55 + rnd() * 0.4), 100), open: n > 0 && y === 4 && rnd() < 0.4 ? 1 : 0, largest: n === 0 ? 'None' : pick(['Slip and fall', 'Kitchen fire', 'Water damage', 'Theft', 'Wind damage to roof', 'Customer injury', 'Vehicle into storefront']) };
  });
  const sub = {
    submission_id: id, broker_id: broker.broker_id, received_at: iso(received), insured_name: name, mailing_street: locs[0].street, mailing_city: locs[0].city, mailing_state: state,
    declared_class: declared, operations_description: `${name} ${ops}.`, years_in_business: years, annual_revenue: revenue, employees: int(8, 240),
    requested_limit: pick([1e6, 2e6, 5e6]), deductible: pick([5000, 10000, 25000]), effective_date: ymd(new Date(received.getTime() + int(20, 60) * 864e5)), total_tiv: tiv,
    has_application: 'Y', has_sov: 'Y', has_loss_runs: o.noLossRuns ? 'N' : 'Y', status: 'New',
  };
  submissions.push(sub); locations.push(...locs);
  if (!o.noLossRuns) for (const l of losses) lossTruth.push({ submission_id: id, ...l });
  emails.push({ submission_id: id, sent_at: sub.received_at, from_name: `${pick(['Dana', 'Marcus', 'Priya', 'Leon', 'Avery', 'Jordan', 'Celia', 'Tomas'])} ${pick(['Whitlow', 'Abara', 'Kensington', 'Roarke', 'Delacroix', 'Mbeki', 'Sutter'])}`, subject: `New submission: ${name} (${c.name.split(' (')[0]})`,
    body: o.email ?? `Hi team, attached is a new submission for ${name}, effective ${sub.effective_date}. ${nLoc} location(s), total insured value about $${(tiv / 1e6).toFixed(1)}M. Application, statement of values, and five years of loss runs attached. Target premium is competitive; let me know if you need anything else.` });
  return { sub, locs, losses };
}

// Story 4: a clean, high-fit office risk from a top broker, received late so it sits near the bottom of the FIFO queue.
// Story 1: a restaurant submission that arrived without loss runs.
// Story 2: declared as a warehouse, but the operations description reveals seasonal fireworks storage.
// Story 3: a hotel schedule packed along the Gulf coast, on top of existing portfolio exposure.
const STORIES = {
  4: () => makeSubmission(4, { cls: 'OFFC', name: 'Kelridge Office Partners', city: 'Charlotte', nLoc: 3, broker: brokers[0], received: daysAgo(0, 8), years: 22, locTiv: [9.2e6, 7.4e6, 6.1e6], construction: 'Fire resistive',
    ops: 'owns and leases three Class A office buildings to professional tenants; fully sprinklered with monitored alarms', losses: [2021, 2022, 2023, 2024, 2025].map((y) => ({ year: y, carrier: 'Arbelle Mutual', claims: y === 2023 ? 1 : 0, incurred: y === 2023 ? 6400 : 0, paid: y === 2023 ? 6400 : 0, open: 0, largest: y === 2023 ? 'Water damage' : 'None' })) }),
  1: () => makeSubmission(1, { cls: 'REST', name: 'Tollbridge Kitchen Co', city: 'Tampa', nLoc: 3, broker: brokers[4], received: daysAgo(6, 10), locTiv: [2.6e6, 2.1e6, 1.9e6], noLossRuns: true,
    email: 'Hi team, new submission for Tollbridge Kitchen Co, three restaurants in the Tampa area. Application and SOV attached. Loss runs have been requested from the prior carrier and will follow next week. Would love an indication before then if possible.' }),
  2: () => makeSubmission(2, { cls: 'WHSE', declared: 'WHSE', name: 'Gravelin Distribution', city: 'San Antonio', nLoc: 2, broker: brokers[8], received: daysAgo(9, 14), locTiv: [8.4e6, 5.2e6],
    ops: 'operates a regional distribution warehouse for party supplies and seasonal goods; from June through early July the warehouse also stores and ships consumer fireworks to roadside stands' }),
  3: () => makeSubmission(3, { cls: 'HOTL', name: 'Marquette Shores Hospitality', city: 'Clearwater Beach', nLoc: 5, broker: brokers[1], received: daysAgo(4, 11), construction: 'Masonry non-combustible',
    locCities: ['Clearwater Beach', 'St. Petersburg', 'Sarasota', 'Naples', 'Fort Myers'], locTiv: [11.5e6, 9.8e6, 10.4e6, 12.2e6, 8.6e6],
    locPoints: [[27.9785, -82.8275], [27.7350, -82.7420], [27.3170, -82.5770], [26.1400, -81.8030], [26.4520, -81.9500]],
    ops: 'operates five beachfront select-service hotels on the Gulf coast of Florida' }),
};
// Several Florida restaurants with high TIV this month, so the Ask example has real answers.
const FL_BIG_REST = [
  { name: 'Dalmora Grill Holdings', city: 'Miami', locTiv: [2.4e6, 2.2e6, 1.8e6], received: daysAgo(3, 9) },
  { name: 'Selwyn Table & Tap', city: 'Orlando', locTiv: [3.1e6, 2.7e6], received: daysAgo(11, 15) },
  { name: 'Hestor Bistro Group', city: 'Jacksonville', locTiv: [2.9e6, 1.6e6, 1.4e6], received: daysAgo(15, 10) },
];

const N = 150;
for (let i = 1; i <= N; i++) {
  if (STORIES[i]) { STORIES[i](); continue; }
  if (i >= 5 && i <= 7) { const f = FL_BIG_REST[i - 5]; makeSubmission(i, { cls: 'REST', name: f.name, city: f.city, nLoc: f.locTiv.length, locTiv: f.locTiv, received: f.received }); usedNames.add(f.name); continue; }
  makeSubmission(i);
}

// ---------------------------------------------------------------------------
// Portfolio: bound policies and their location exposure (dense on Florida's Gulf coast)
// ---------------------------------------------------------------------------
const policies = [], exposure = [];
const HOT = [['Clearwater Beach', 40], ['St. Petersburg', 40], ['Sarasota', 35], ['Naples', 30], ['Fort Myers', 25], ['Tampa', 40], ['Miami', 45], ['Fort Lauderdale', 25], ['Houston', 40], ['Galveston', 12]];
const COOL = CITIES.map((c) => [c[0], 10]);
let p = 0;
for (const [city, n] of [...HOT, ...COOL]) {
  for (let k = 0; k < n; k++) {
    const [, st, la, lo] = CITY[city];
    const id = `POL-${String(++p).padStart(5, '0')}`;
    const cls = pick(['REST', 'OFFC', 'RETL', 'APTS', 'HOTL', 'WHSE', 'MFGL']);
    const tiv = round(1e6 + rnd() * (cls === 'APTS' || cls === 'HOTL' || cls === 'OFFC' ? 14e6 : 5e6), 5000);
    policies.push({ policy_id: id, insured_name: `${pick(STEM_A)} ${pick(STEM_B[cls])}`, class_code: cls, state: st, bound_date: ymd(daysAgo(int(30, 700))), premium: round(tiv * (0.0018 + rnd() * 0.0025), 100), total_tiv: tiv });
    exposure.push({ policy_id: id, loc_no: 1, city, state: st, latitude: jitter(la, city.includes('Beach') || city === 'Naples' ? 0.03 : 0.08), longitude: jitter(lo, city.includes('Beach') || city === 'Naples' ? 0.03 : 0.08), tiv });
  }
}
// A handful of recent quotes on earlier submissions (not on the story records).
const quotes = submissions.filter((s, i) => i > 20 && i % 9 === 0).map((s, k) => ({ quote_id: `Q-${String(k + 1).padStart(4, '0')}`, submission_id: s.submission_id, quoted_at: iso(daysAgo(int(0, 5), 15)), premium: round(s.total_tiv * 0.0031, 100), status: pick(['Issued', 'Issued', 'Bound', 'Lost']) }));
for (const q of quotes) submissions.find((s) => s.submission_id === q.submission_id).status = 'Quoted';

// ---------------------------------------------------------------------------
// Minimal PDF writer (text, lines, boxes; Helvetica) — no dependencies.
// ---------------------------------------------------------------------------
function pdf(pages) {
  const esc = (s) => String(s).replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, '-');
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = objs.length + 1; objs.push(null);
  const kids = [];
  for (const ops of pages) {
    const body = ops.map((o) => o.t !== undefined
      ? `BT /${o.b ? 'F2' : 'F1'} ${o.s ?? 9} Tf ${o.x} ${o.y} Td (${esc(o.t)}) Tj ET`
      : o.rect ? `${o.rect.join(' ')} re S` : `${o.line.slice(0, 2).join(' ')} m ${o.line.slice(2).join(' ')} l S`).join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const usd = (x) => `$${Math.round(x).toLocaleString('en-US')}`;
function wrap(text, n) { const w = text.split(' '); const lines = []; let l = ''; for (const x of w) { if ((l + ' ' + x).trim().length > n) { lines.push(l.trim()); l = x; } else l += ' ' + x; } if (l.trim()) lines.push(l.trim()); return lines; }

// The same drawing as an SVG page, so the app can overlay AI_EXTRACT citation boxes on it.
function svg(ops) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = ops.map((o) => o.t !== undefined
    ? `<text x="${o.x}" y="${792 - o.y}" font-size="${o.s ?? 9}"${o.b ? ' font-weight="bold"' : ''}>${esc(o.t)}</text>`
    : o.rect ? `<rect x="${o.rect[0]}" y="${792 - o.rect[1] - o.rect[3]}" width="${o.rect[2]}" height="${o.rect[3]}" fill="none" stroke="#333" stroke-width="0.8"/>`
      : `<line x1="${o.line[0]}" y1="${792 - o.line[1]}" x2="${o.line[2]}" y2="${792 - o.line[3]}" stroke="#333" stroke-width="0.8"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" font-family="Helvetica, Arial, sans-serif" fill="#111"><rect width="612" height="792" fill="#fff"/>${body}</svg>`;
}
const SVGS = {};

function applicationPdf(s, locs) {
  const b = brokers.find((x) => x.broker_id === s.broker_id);
  const ops = [];
  ops.push({ t: 'COMMERCIAL INSURANCE APPLICATION', x: 40, y: 750, s: 14, b: true }, { t: 'Synthetic example form - not an industry standard form', x: 40, y: 734, s: 8 });
  ops.push({ t: `Submission reference: ${s.submission_id}`, x: 400, y: 750, s: 9 }, { line: [40, 726, 572, 726] });
  const field = (label, value, x, y) => { ops.push({ t: label, x, y, s: 7, b: true }, { t: value, x, y: y - 12, s: 10 }, { rect: [x - 4, y - 18, 262, 30] }); };
  let y = 700;
  const rows = [
    ['NAMED INSURED', s.insured_name, 'PRODUCER / BROKER', b.broker_name],
    ['MAILING ADDRESS', `${s.mailing_street}, ${s.mailing_city}, ${s.mailing_state}`, 'PROPOSED EFFECTIVE DATE', s.effective_date],
    ['YEARS IN BUSINESS', String(s.years_in_business), 'ANNUAL REVENUE', usd(s.annual_revenue)],
    ['NUMBER OF EMPLOYEES', String(s.employees), 'LINE OF BUSINESS', 'Commercial package (property and general liability)'],
    ['REQUESTED LIMIT (PER OCCURRENCE)', usd(s.requested_limit), 'DEDUCTIBLE', usd(s.deductible)],
    ['BUSINESS TYPE (AS DECLARED)', CLASS[s.declared_class].name, 'NUMBER OF LOCATIONS', String(locs.length)],
  ];
  for (const [l1, v1, l2, v2] of rows) { field(l1, v1, 44, y); field(l2, v2, 312, y); y -= 38; }
  ops.push({ t: 'NATURE OF OPERATIONS / DESCRIPTION OF BUSINESS', x: 40, y: y, s: 8, b: true });
  y -= 14;
  for (const l of wrap(s.operations_description, 100)) { ops.push({ t: l, x: 44, y, s: 9 }); y -= 12; }
  y -= 10;
  ops.push({ t: 'SCHEDULE OF LOCATIONS (see statement of values for full detail)', x: 40, y, s: 8, b: true }); y -= 14;
  const cols = [44, 80, 270, 380, 470];
  ['LOC', 'STREET', 'CITY', 'STATE', 'TIV'].forEach((h, i) => ops.push({ t: h, x: cols[i], y, s: 7, b: true }));
  y -= 4; ops.push({ line: [40, y, 572, y] }); y -= 12;
  for (const l of locs) { [String(l.loc_no), l.street, l.city, l.state, usd(l.tiv)].forEach((v, i) => ops.push({ t: v, x: cols[i], y, s: 9 })); y -= 13; }
  ops.push({ t: `TOTAL INSURED VALUE: ${usd(s.total_tiv)}`, x: 380, y: y - 6, s: 9, b: true });
  ops.push({ t: 'Signed by applicant. All values are synthetic and generated for a software example.', x: 40, y: 60, s: 7 });
  SVGS[`${s.submission_id}_application`] = svg(ops);
  return pdf([ops]);
}

function lossRunPdf(s, losses) {
  const ops = [];
  ops.push({ t: 'LOSS RUN REPORT - CURRENTLY VALUED', x: 40, y: 750, s: 14, b: true }, { t: `Insured: ${s.insured_name}`, x: 40, y: 730, s: 10 }, { t: `Valued as of: 2026-10-31   Reference: ${s.submission_id}`, x: 40, y: 716, s: 9 });
  ops.push({ t: 'Five-year loss history', x: 40, y: 690, s: 10, b: true });
  const cols = [44, 110, 250, 310, 390, 470, 520];
  let y = 670;
  ['Policy Year', 'Carrier', 'Claims', 'Incurred', 'Paid', 'Open', 'Largest Loss'].forEach((h, i) => ops.push({ t: h, x: cols[i], y, s: 8, b: true }));
  y -= 5; ops.push({ line: [40, y, 590, y] }); y -= 14;
  for (const l of losses) { [String(l.year), l.carrier, String(l.claims), usd(l.incurred), usd(l.paid), String(l.open), l.largest].forEach((v, i) => ops.push({ t: v, x: cols[i], y, s: i === 6 ? 7 : 9 })); y -= 16; }
  ops.push({ line: [40, y + 6, 590, y + 6] });
  const tot = losses.reduce((a, l) => ({ c: a.c + l.claims, i: a.i + l.incurred, p: a.p + l.paid }), { c: 0, i: 0, p: 0 });
  ops.push({ t: `Totals: ${tot.c} claims, ${usd(tot.i)} incurred, ${usd(tot.p)} paid`, x: 44, y: y - 8, s: 9, b: true });
  ops.push({ t: 'Synthetic loss run generated for a software example. Not an actual carrier report.', x: 40, y: 60, s: 7 });
  SVGS[`${s.submission_id}_loss_runs`] = svg(ops);
  return pdf([ops]);
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------
rmSync('data/csv', { recursive: true, force: true }); rmSync('data/docs', { recursive: true, force: true });
mkdirSync('data/csv', { recursive: true }); mkdirSync('data/docs', { recursive: true });
const csv = (rows) => { const cols = Object.keys(rows[0]); const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n'; };
const out = { brokers, appetite_guide: appetite, submissions, sov_locations: locations, broker_emails: emails, bound_policies: policies, portfolio_exposure: exposure, quotes, coastline_points: COAST.map(([la, lo], i) => ({ point_id: i + 1, latitude: la, longitude: lo })), loss_runs_keyed: lossTruth };
for (const [name, rows] of Object.entries(out)) writeFileSync(`data/csv/${name}.csv.gz`, gzipSync(csv(rows)));

const byId = Object.groupBy(locations, (l) => l.submission_id);
const lossBy = Object.groupBy(lossTruth, (l) => l.submission_id);
for (const s of submissions) {
  writeFileSync(`data/docs/${s.submission_id}_application.pdf`, applicationPdf(s, byId[s.submission_id]));
  if (s.has_loss_runs === 'Y') writeFileSync(`data/docs/${s.submission_id}_loss_runs.pdf`, lossRunPdf(s, lossBy[s.submission_id]));
}
rmSync('public/docs', { recursive: true, force: true }); mkdirSync('public/docs', { recursive: true });
for (const [k, v] of Object.entries(SVGS)) writeFileSync(`public/docs/${k}.svg`, v);
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join('\n'));
