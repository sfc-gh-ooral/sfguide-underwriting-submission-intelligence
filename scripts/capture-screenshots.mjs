// Captures the landing-page screenshots and catalog card images from the hosted example.
//
//   npm run build:example        # refresh docs/try/ first if the UI changed
//   npm run capture              # writes docs/images/*.png and docs/catalog/*.jpg
//
// Runs headless Chromium at a fixed viewport, so image size never depends on your screen
// or editor window. It uses a fresh browser with no sign-in: only synthetic sample data
// can appear in the images. Review every image before publishing anyway.

import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const BASE = "/sfguide-underwriting-submission-intelligence/try"; // must match basePath in next.config.ts
const CARD_ID = "underwriting-submission-intelligence";           // catalog id: cards are <id>-<n>.jpg

const VIEWPORT = { width: 1600, height: 1000 };       // 16:10, same shape as catalog cards
const PAGE_SCALE = 1.25;                              // 2000x1250 PNGs: sharp, and under the guide's 500 KB
const CARD_SCALE = 0.6;                               // 1600x1000 CSS px -> 960x600 card
const SCHEME = process.env.COLOR_SCHEME || "dark";   // "dark" or "light"

// The walkthrough, in landing-page order. `card` marks which shots become catalog cards (in that order).
const SHOTS = [
  { name: "01-queue", card: 1, path: "/", wait: "text=Kelridge Office Partners" },
  {
    name: "02-hidden-class", card: 2, path: "/submission/?id=SUB-1002", wait: "text=Gravelin Distribution",
    async act(page) { await page.getByRole("button", { name: /Declared business type/ }).click(); },
  },
  {
    name: "03-memo", card: 3, path: "/submission/?id=SUB-1003", wait: "text=Marquette Shores",
    async act(page) {
      await page.getByRole("button", { name: "Draft memo" }).click();
      await page.getByText("Sample AI response").first().waitFor({ timeout: 20000 });
      await toTop(page, "Appetite check");
    },
  },
  {
    name: "04-request-info", card: 4, path: "/submission/?id=SUB-1001", wait: "text=Tollbridge Kitchen",
    async act(page) {
      await page.getByRole("button", { name: /Request info/ }).click();
      await page.locator("#email-draft").waitFor({ timeout: 20000 });
      await toTop(page, "Underwriting memo draft");
    },
  },
  { name: "05-portfolio-fit", card: 5, path: "/portfolio/?id=SUB-1003", wait: "text=Exposure map" },
  {
    name: "06-ask", card: 6, path: "/ask/",
    async act(page) {
      await page.getByRole("button", { name: "Show restaurants in Florida with TIV over $5M submitted this month." }).last().click();
      await page.getByText("Sample AI response").first().waitFor({ timeout: 20000 });
    },
  },
];

// Scrolls a card heading to just below the sticky header.
async function toTop(page, heading) {
  await page.getByRole("heading", { name: heading }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

// Serves docs/try/ at the GitHub Pages path, the way the hosted example is published.
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DOCS, "try", decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(join(DOCS, "try"))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Let entrance animations finish so every run produces the same frame.
  await page.waitForTimeout(800);
}

async function main() {
  if (!existsSync(join(DOCS, "try", "index.html"))) throw new Error("docs/try/ is missing. Run `npm run build:example` first.");
  mkdirSync(join(DOCS, "images"), { recursive: true });
  mkdirSync(join(DOCS, "catalog"), { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      for (const [scale, out] of [
        [PAGE_SCALE, join(DOCS, "images", `${shot.name}.png`)],
        ...(shot.card ? [[CARD_SCALE, join(DOCS, "catalog", `${CARD_ID}-${shot.card}.jpg`)]] : []),
      ]) {
        const context = await browser.newContext({
          viewport: VIEWPORT, deviceScaleFactor: scale, colorScheme: SCHEME, reducedMotion: "reduce",
          // Fixed locale and time zone so dates render the same on every machine.
          locale: "en-US", timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        await page.goto(origin + shot.path);
        if (shot.wait) await page.locator(shot.wait).first().waitFor();
        await settle(page);
        if (shot.act) { await shot.act(page); await settle(page); }
        await page.screenshot({ path: out, ...(out.endsWith(".jpg") ? { type: "jpeg", quality: 82 } : {}) });
        await context.close();
        console.log(`${out.replace(ROOT + "/", "")}  ${Math.round(statSync(out).size / 1024)} KB`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((failure) => { console.error(failure.message); process.exit(1); });
