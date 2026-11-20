# Design: Quorvane Submission Desk

This file sets the brand and visual direction for the app and the landing page. Tokens here are the
source for `app/globals.css` and `docs/assets/site.css`.

## Brand

- **Name:** Quorvane, a coined name for a fictional commercial property underwriting desk. "Quorvane
  Submission Desk" in the app header; "Quorvane" alone in tight spaces. The name, the carrier and every
  broker and insured in the data are invented.
- **Logo mark:** a rounded square in marine ink holding a saffron "intake chevron" over three ruled
  lines: a submission dropping onto a ledger. Inline SVG (`components/Brand.tsx`, repeated in
  `docs/index.html`), no image files.

```svg
<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0F2A3A"/>
<path d="M9 9l7 6 7-6" fill="none" stroke="#E0A33A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9 19h14M9 23h10" stroke="#F6F2EA" stroke-width="2" stroke-linecap="round" opacity=".85"/></svg>
```

- **Voice:** one underwriter talking to another. Short, specific, numeric. "4 of 5 locations sit within
  16 km of the coast", never "AI-powered insights". Verbs on buttons say what happens ("Request loss
  runs", "Move to quote"). AI output is always called a draft.

## Direction: "the underwriting docket"

A working desk, not a dashboard. Underwriters live in an inbox of broker submissions, so the main screen
is a **split-pane docket**: a ranked list on the left and the selected file's preview on the right, like a
mail client. Detail pages read like a case file: document on the left, findings on the right, a decision
rail that stays in reach.

### Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#F6F2EA` | `#0E1A21` | App background (warm paper, not white) |
| `--sheet` | `#FFFDF8` | `#14242D` | Cards, panes |
| `--sheet-2` | `#EFE9DD` | `#1B2F3A` | Insets, table header, document well |
| `--rule` | `#DDD4C3` | `#2A4250` | Hairlines |
| `--ink` | `#0F2A3A` | `#ECE6DA` | Primary text, top bar (light mode) |
| `--ink-2` | `#3D5160` | `#B5C1C8` | Secondary text |
| `--ink-3` | `#56656F` | `#8EA0AA` | Muted labels |
| `--marine` | `#0F2A3A` | `#0A151B` | Top navigation bar |
| `--saffron` | `#E0A33A` | `#E8B054` | Brand accent fills (logo, active tab rule, focus) |
| `--saffron-ink` | `#8A5A0B` | `#F0C374` | Saffron text on paper (AA) |
| `--sea` | `#1F6F66` | `#5CC2B4` | In appetite, positive, primary action |
| `--amber` | `#8F5400` | `#F2B45A` | Refer, incomplete |
| `--rust` | `#A3341F` | `#F08A73` | Out of appetite, coastal, decline |
| `--ai` | `#4B3FA0` | `#ABA2F2` | AI drafts (violet ink, used sparingly) |

Every text/background pair is checked against WCAG AA with `scripts/check-contrast.mjs`.

### Typography

- **IBM Plex Sans** for UI text, **IBM Plex Mono** for every figure, ID and score (tabular), and
  **IBM Plex Serif** italic only for the docket date stamp. Self-hosted via `next/font`; the landing page
  reuses the built woff2 files from `docs/fonts/` (SIL Open Font License, included).
- Scale: 12 / 13 / 14 / 16 / 20 / 28 / 40. Labels are small caps-style (12 px, 0.06em tracking).

### Layout model and density

- **Top navigation bar** in marine ink with tabs (Docket, File, Portfolio fit, Ask), the logo, an
  environment badge (Sample or Live), a role chip ("M. Okafor · Property UW"), and a theme toggle. No
  sidebar. On phones the tabs become a horizontal scroller under the bar.
- **Docket:** a "morning docket" strip (date stamp, six KPI figures with counters and sparklines), then
  the split pane: list 58%, preview 42%. Under 1024 px the preview opens as a bottom sheet.
- **File:** two columns at ≥1280 px (document viewer | findings), a sticky decision rail at the top
  right; one column below.
- Density is medium-high: 13 px table text, 44 px rows, 16 px card padding.

### Charts

Thin strokes, flat fills, no gradients inside charts. Sea for in-appetite and paid, saffron for the
selected risk and incurred, rust for coastal/out, hatched pattern for open claims. Every chart has a
legend and a tooltip on a paper-colored card. The exposure map is a hand-drawn SVG: coastline as a
dashed ink line, portfolio H3 cells as saffron dots sized by TIV, the submission's locations as numbered
ink pins.

### Motion and effects

- Docket rows fade and rise in (20 ms stagger), selected row gets a saffron left rule that slides.
- KPI figures count up on first load; skeleton bars (paper shimmer) while data loads.
- AI drafts: staged reasoning steps with a progress rule, then a typewriter-style reveal by word,
  then citation chips. Sample mode keeps the "Sample AI response" label on every draft.
- Hover lifts cards by 1 px with a warmer shadow. All motion respects `prefers-reduced-motion`.
- One subtle effect: a faint ruled-paper pattern behind the docket strip.

## How this differs from the existing catalog

Looked at the landing pages and Try apps of Auto Finance Portfolio Analytics, Workforce Intelligence,
Loss Triangles, Insurance Sales Agent, Site Selection, Card Fraud Console and Cyber Risk Copilot.

| Pack | Its look | What Quorvane avoids |
| --- | --- | --- |
| Auto Finance (Odometer) | Dark teal left sidebar, big dark gradient hero card, green accent, geometric sans | No sidebar, no gradient hero, no green |
| Workforce Intelligence | Indigo left sidebar, serif display headline with gradient text, pastel blob KPI tiles | No serif headlines, no gradient text, no blob tiles |
| Loss Triangles | Full dark UI, purple accent, sidebar, Inter | Light warm paper by default, no purple brand |
| Site Selection | White page, blue headings, green bars, filter column | Not white, no filter column, mono figures |
| Insurance Sales Agent / Cyber Risk | Sidebar app shells with blue or dark accents | Top bar plus split-pane inbox instead |

Distinct choices: warm paper background, marine top bar, saffron accent, IBM Plex type family with mono
figures, an inbox-style split pane, and a document viewer with extraction highlights as the visual
centerpiece. The landing page uses an editorial "case file" layout (left-aligned headline with a docket
card mock beside it), not a centered gradient hero.
