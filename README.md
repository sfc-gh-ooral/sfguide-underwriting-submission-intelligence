# Underwriting Submission Intelligence

Help commercial underwriters clear submission backlogs by extracting broker submissions, checking appetite and completeness, and prioritizing the best-fit risks.

This is a Snowflake example on **synthetic data**: a Next.js app with a no-account Sample mode and a Live mode that reads broker PDFs with `AI_PARSE_DOCUMENT`, `AI_EXTRACT` (fields with citations, and loss-run tables), and `AI_CLASSIFY`; checks the appetite guide with Cortex Search; measures coastal concentration with geospatial functions; drafts memos and broker emails with `AI_COMPLETE`; and answers pipeline questions with a Cortex Agent over a semantic view (Cortex Analyst).

**[Try the hosted example](https://sfc-gh-ooral.github.io/sfguide-underwriting-submission-intelligence/try/)** · **[Guide](https://sfc-gh-ooral.github.io/sfguide-underwriting-submission-intelligence/)**

The app is branded **Quorvane Submission Desk**, a fictional commercial property desk; see [docs/DESIGN.md](docs/DESIGN.md) for the brand, palette, typography and layout.

> Synthetic data and illustrative logic only. This is not underwriting, regulatory, or compliance advice, and it is not a production system. Scores and AI drafts are suggestions for an underwriter to review.

## What it does

| Screen | What you see | Snowflake capability (Live mode) |
| --- | --- | --- |
| Docket | Morning docket: six KPI tiles with counters, daily arrivals, the appetite mix, and a split pane with open submissions ranked by fit score (or first in, first out), search and filters, and a preview of each file's fit components | `AI_EXTRACT`, `AI_CLASSIFY`, SQL view `SUBMISSION_SCORES` |
| Submission file | The application page with the source of each extracted field highlighted, missing items, the appetite check with guide passages, a loss-run chart, the broker email, an AI memo draft, and decisions: request info (AI-drafted email), decline with reason, or move to quote | `AI_PARSE_DOCUMENT`, `AI_EXTRACT` with `citation => TRUE` and table extraction, Cortex Search, `AI_COMPLETE`, `APP.DECISIONS` |
| Portfolio fit | The submission's locations on a longitude/latitude map against existing exposure by H3 cell and the coastline, distance to coast, portfolio TIV within 25 km, and the change in coastal share | `ST_DISTANCE`, `ST_DWITHIN`, `H3_LATLNG_TO_CELL` |
| Ask | Plain-language questions such as "Show restaurants in Florida with TIV over $5M submitted this month", with the results table and generated SQL | Cortex Agent with Cortex Analyst on the `SUBMISSIONS_SV` semantic view, and Cortex Search |
| Sample / Live switch | Environment badge in the top bar that always shows the mode. Sample keeps the bundled data even with a connection; Live with no connection shows setup steps. AI drafts show staged progress steps, then reveal word by word with source chips; in Sample mode a recorded answer arrives after a few seconds, labeled Sample AI response | `/api/mode` reports whether `.env.local` is configured. Live calls show measured latency and never fall back to sample data |

### Story on this synthetic data set

1. **Kelridge Office Partners** (SUB-1004), a clean, complete office risk from a Top broker, ranks **first by fit score** but is **130th first in, first out**.
2. **Gravelin Distribution** (SUB-1002) declares a warehouse, but its operations description mentions seasonal fireworks storage. `AI_CLASSIFY` assigns the fireworks class, which is out of appetite.
3. **Marquette Shores Hospitality** (SUB-1003) schedules five beachfront hotels ($52.5M) along Florida's Gulf coast, where the book already holds heavy exposure.
4. **Tollbridge Kitchen Co** (SUB-1001) arrived without loss runs; the app drafts the request to the broker.

See [data/README.md](data/README.md) for how the data and stories are generated.

## Prerequisites

| | |
| --- | --- |
| No-account mode | Node.js **20.19+ or 22.12+** (required by Tailwind CSS 4) and npm. Nothing else. |
| Live mode: edition | Any edition. No Enterprise-only features are used. |
| Live mode: features | Cortex AI functions (`AI_PARSE_DOCUMENT`, `AI_EXTRACT`, `AI_CLASSIFY`, `AI_COMPLETE`), Cortex Search, Cortex Analyst, Cortex Agents, semantic views, and Git repository clones, available in your region or through [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference). The default model for drafts is `claude-sonnet-4-5`; set `SNOWFLAKE_COMPLETE_MODEL` to use another. |
| Live mode: role | `ACCOUNTADMIN` (or a role that can create roles, warehouses, databases, and API integrations) for the short first block of `sql/setup.sql`. Everything else runs as the least-privilege `QUORVANE_DEMO_ROLE`. |
| Preview features | None. Everything used here was generally available when tested (November 2026). |
| Tested | Next.js 16.3, Node 22.23, snowflake-sdk 3.4, on an AWS US account, November 2026 |

## Quick start: no account

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-underwriting-submission-intelligence.git
cd sfguide-underwriting-submission-intelligence
npm install
npm run dev
```

Open http://localhost:3000. With no `.env.local`, the app runs in Sample mode in your browser on results captured from a Live run (`public/mock/`). Every AI output is labeled **Sample AI response**.

To regenerate the synthetic data and documents (same seed, same files): `npm run generate-data`.

## Live mode: deploy to your account

1. **Run the setup.** Open a Snowsight SQL worksheet, paste [`sql/setup.sql`](sql/setup.sql), and run all. It loads the synthetic PDFs and CSVs straight from this public repository through a Git repository clone, so there's no upload step, and then runs the document AI over all 299 PDFs. It took 3 minutes 6 seconds (186 s) in our latest test.
2. **Create a key pair** for the user that ran setup (setup grants that user `QUORVANE_DEMO_ROLE`). Keep the key outside the repository:

   ```bash
   mkdir -p ~/.snowflake/keys
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out ~/.snowflake/keys/quorvane_rsa_key.p8 -nocrypt
   openssl rsa -in ~/.snowflake/keys/quorvane_rsa_key.p8 -pubout
   ```

   ```sql
   -- Uses the second key slot so an existing key is not replaced.
   ALTER USER <YOUR_USER> SET RSA_PUBLIC_KEY_2 = '<public key body without header lines>';
   ```

3. **Configure the app.** Copy `.env.example` to `.env.local` and fill in your account identifier (`<org>-<account>`), user, and key path.
4. **Run it.** Run `npm run dev`. Each screen shows a **Live · QUORVANE_DEMO_ROLE · <ms>** badge. Decisions go to `APP.DECISIONS` and AI drafts to `APP.AI_DRAFTS`.

The app connects as `QUORVANE_DEMO_ROLE`, runs `USE SECONDARY ROLES NONE`, and uses bind variables for every statement.

To refresh the Sample-mode files from your own Live run: start `npm run dev` with `.env.local`, then run `npm run capture-sample -- http://localhost:3000` (it drafts a memo and an email for every open submission, so it uses AI credits).

### Objects created

| Object | Name | Notes |
| --- | --- | --- |
| Role | `QUORVANE_DEMO_ROLE` | Owns everything below; granted `SNOWFLAKE.CORTEX_USER` |
| Warehouse | `QUORVANE_WH` | XSMALL, `AUTO_SUSPEND = 60`, starts suspended |
| Database | `UNDERWRITING_SUBMISSION_DEMO` | Schemas `UW` and `APP` |
| Integration | `QUORVANE_GIT_API` | `git_https_api`, limited to `https://github.com/sfc-gh-ooral/`, no credentials |
| Git clone and stages | `QUORVANE_REPO`, `QUORVANE_DATA`, `SUBMISSION_DOCS` | `SUBMISSION_DOCS` has a directory table and server-side encryption for the AI file functions |
| Source tables (UW) | `SUBMISSIONS`, `SOV_LOCATIONS`, `BROKER_EMAILS`, `BROKERS`, `APPETITE_GUIDE`, `BOUND_POLICIES`, `PORTFOLIO_EXPOSURE`, `QUOTES`, `COASTLINE_POINTS`, `LOSS_RUNS_KEYED`, `CONFIG` | Synthetic; `CONFIG` freezes the business date at 2026-11-18 |
| Document AI tables | `DOC_TEXT`, `APP_EXTRACT`, `LOSS_EXTRACT`, `CLASS_PREDICTIONS` | Outputs of `AI_PARSE_DOCUMENT`, `AI_EXTRACT`, and `AI_CLASSIFY` |
| Views and tables | `LOSS_RUNS`, `LOCATION_EXPOSURE`, `PORTFOLIO_CELLS`, `SUBMISSION_SCORES` | Flattened loss runs, geospatial exposure, appetite rules, and the fit score |
| Cortex Search | `APPETITE_SEARCH` | Over the appetite guide |
| Semantic view | `SUBMISSIONS_SV` | For Cortex Analyst |
| Cortex Agent | `SUBMISSION_ASSISTANT` | Tools: Cortex Analyst on `SUBMISSIONS_SV`, Cortex Search on `APPETITE_SEARCH` |
| App tables | `APP.DECISIONS`, `APP.AI_DRAFTS` | Underwriter decisions and every AI draft with prompt, model, sources, and latency |

**Cleanup:** run [`sql/cleanup.sql`](sql/cleanup.sql). It drops the database and warehouse as `QUORVANE_DEMO_ROLE` (which owns them), then the integration and the role as `ACCOUNTADMIN`. If you registered a key for this example, also run `ALTER USER <YOUR_USER> UNSET RSA_PUBLIC_KEY_2;`.

### Expected cost and time

- **Setup:** 3 minutes 6 seconds (186 s) from a clean account in our latest test (20 November 2026; 3 minutes 13 seconds in an earlier run), most of it the document AI over 299 PDFs. The warehouse ran for about that long, so expect roughly **0.1 warehouse credits** on XSMALL for setup (an estimate from measured run time: metering history lagged by hours when we checked).
- **AI credits:** `AI_PARSE_DOCUMENT`, `AI_EXTRACT`, `AI_CLASSIFY`, `AI_COMPLETE`, Cortex Search, Cortex Analyst, and Cortex Agents are billed separately from the warehouse, by pages or tokens. Setup processes 150 application pages twice (parse and extract), 149 loss-run pages, and 150 classifications. Check actual usage in `SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY` and `CORTEX_AGENT_USAGE_HISTORY` (they can lag a few hours) and the [Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf) for rates. Running `npm run capture-sample` adds about 270 `AI_COMPLETE` drafts.
- **Measured latency** in our test, from the app server on XSMALL:
  - Queue: under 1 s warm. Submission detail (including a Cortex Search call): about 1–2 s. Portfolio fit: about 0.5 s.
  - Memo draft (`AI_COMPLETE`): median 6.8 s (5.7–11.7 s over 138 drafts).
  - Broker email draft: median 4.5 s (3.3–8.8 s over 136 drafts).
  - Ask (Cortex Agent): 10–20 s over four questions.
  - Spot checks on 20 November 2026: queue 3.7 s cold, memo 9.1 s, broker email 6.0 s, Ask 19.6 s.

  Yours will differ. The app shows the measured time on each live response.

## How the fit score works

`SUBMISSION_SCORES` adds five parts, out of 100:

| Part | Points | Rule |
| --- | --- | --- |
| Appetite | 35 / 18 / 0 | In / refer / out. Refer if the class needs referral, any location is within 16 km of the coast in FL, TX, or LA, the account is in LA, TIV exceeds the class maximum, five-year incurred is above $250K, or more than one claim is open |
| Completeness | 0–20 | Application, statement of values, and five years of loss runs |
| Broker value | 4–25 | Tier (Top 15, Core 9, Emerging 4) plus hit ratio × 10 |
| Loss history | 0–15 | 15 × (1 − incurred ÷ $250K); 0 if loss runs are missing |
| Concentration | 0–10 | 10 × (1 − coastal TIV added ÷ $40M) |

Out-of-appetite submissions are capped at 15. The weights are illustrative; see "Customize with Cortex Code".

## Known limitations

- **Clean synthetic documents.** The PDFs are generated one-page layouts with embedded text. On them, `AI_EXTRACT` matched the generator's values for all 150 insured names and TIVs and all 745 loss-run rows. Scanned, multi-page, or handwritten broker packets will be less accurate; measure on your own keyed sample (`LOSS_RUNS_KEYED` shows the pattern).
- **AI_PARSE_DOCUMENT runs in OCR mode.** In our test, `LAYOUT` mode took about 5 seconds per page and ran nearly serially, which would make setup take over 20 minutes. OCR mode keeps setup short; switch to `LAYOUT` if you need tables and headings preserved in the parsed text.
- **Statements of values are CSV.** The SOV "spreadsheets" are loaded as one CSV table rather than parsed from individual workbooks.
- **Snapshot scoring.** Extraction and classification run once in setup. New documents need the section 3 statements re-run (or a stream and task, which this example doesn't build).
- **The map is a plain longitude/latitude plot** of H3 cell centers and a simplified 39-point coastline, with no base map, so no map tiles or external scripts are loaded.
- **The fit score and appetite rules are illustrative**, not a rating or pricing model.
- **Sample mode answers only recorded questions** on the Ask screen; Live mode answers anything.
- **No row-level security.** Every underwriter sees the whole queue; add row access policies by territory or line of business if you need them.

## Customize with Cortex Code

- "Load my appetite guide and turn it into rules plus a searchable index. Show me ambiguous rules."
- "Extract 30 of my sample submissions and measure field accuracy against my keyed data."
- "Weight the fit score toward my target classes and explain each component."

## Project layout

```text
app/                 Next.js App Router pages (queue, submission, portfolio, ask) and the /api/data route
components/          Shell (top bar, tabs, environment badge, theme), Brand (logo), reasoning and streaming AI drafts, UI kit
lib/types.ts         Data interface used by every screen
lib/mock-data.ts     Sample mode: captured results, in the browser (also the hosted /try/ example)
lib/live-data.ts     Live mode: Snowflake queries and AI calls (server only)
lib/snowflake.ts     Connection as QUORVANE_DEMO_ROLE, bind variables
scripts/             generate-data.mjs (seeded data and PDFs), capture-sample.mjs, build-hosted-example.mjs, capture-screenshots.mjs
sql/                 setup.sql, cleanup.sql
data/                Synthetic CSVs, PDFs, and the data README
public/docs, public/mock   Page renders for citation highlights, and captured Sample-mode results
docs/                GitHub Pages guide, DESIGN.md, fonts (IBM Plex, OFL), screenshots, and the /try/ static example
scripts/check-contrast.mjs   Checks the design tokens against WCAG AA
```

## License and disclaimer

Apache 2.0; see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md). This is an illustrative example provided as is. It is not an official Snowflake product and is not supported by Snowflake Support. It contains no customer data.

Owner: Oz Oral · Last reviewed: November 2026
