# Synthetic data

Everything here comes from `scripts/generate-data.mjs` with a fixed seed: same command, same files. Company, broker, carrier, and person names are coined; any resemblance to a real firm is unintended. Run it with `npm run generate-data`.

| File | Rows | What it is |
| --- | --- | --- |
| `csv/submissions.csv.gz` | 150 | Broker submissions received over the 34 days before the business date (18 Nov 2026) |
| `csv/sov_locations.csv.gz` | 325 | Statement-of-values schedule: address, coordinates, construction, year built, sprinklers, TIV |
| `csv/broker_emails.csv.gz` | 150 | The cover email for each submission |
| `csv/brokers.csv.gz` | 14 | Brokers with tier (Top, Core, Emerging), written premium, and hit ratio |
| `csv/appetite_guide.csv.gz` | 18 | Class, territory, completeness, and loss-history rules (indexed by Cortex Search) |
| `csv/bound_policies.csv.gz`, `csv/portfolio_exposure.csv.gz` | 632 each | Existing book, deliberately dense on Florida's Gulf coast, Miami, and Houston |
| `csv/quotes.csv.gz` | 14 | Recent quotes (those submissions leave the open queue) |
| `csv/coastline_points.csv.gz` | 39 | Simplified Gulf and Atlantic coastline for distance-to-coast |
| `csv/loss_runs_keyed.csv.gz` | 745 | The generator's own loss values, used only to measure extraction accuracy |
| `docs/SUB-xxxx_application.pdf` | 150 | One-page commercial application (synthetic layout, not an industry standard form) |
| `docs/SUB-xxxx_loss_runs.pdf` | 149 | Five-year loss run table |

`public/docs/*.svg` are the same pages drawn as SVG so the app can overlay `AI_EXTRACT` citation boxes. `public/mock/` holds results captured from a Live run (`scripts/capture-sample.mjs`) for Sample mode.

## Planted stories

| # | Submission | What you should see |
| --- | --- | --- |
| 1 | **SUB-1001 Tollbridge Kitchen Co** (Tampa restaurants) | No loss run PDF. The queue shows **Missing 1**, completeness drops, and the broker email says loss runs "will follow". The AI-drafted email requests them. |
| 2 | **SUB-1002 Gravelin Distribution** (San Antonio) | Declared as a warehouse, but the operations description mentions seasonal fireworks storage. `AI_CLASSIFY` returns `FIRE`, which is out of appetite, so the score is capped at 15. |
| 3 | **SUB-1003 Marquette Shores Hospitality** | Five beachfront hotels from Clearwater Beach to Naples ($52.5M). Four are within 16 km of the coast, on top of heavy existing exposure; the Portfolio fit screen shows the accumulation. |
| 4 | **SUB-1004 Kelridge Office Partners** (Charlotte) | Clean, complete, fire-resistive office risk from a Top broker, received on the business date: **#1 by fit score but #130 first in, first out**. |

SUB-1005 to SUB-1007 add more Florida restaurants above $5M TIV so the Ask example ("restaurants in Florida with TIV over $5M submitted this month") has several answers.
