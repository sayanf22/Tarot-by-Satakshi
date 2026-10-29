// Full-page screenshots of every page at phone, tablet and desktop widths.
// Usage: node scripts/screenshots.mjs [baseUrl] [comma-separated paths]
// Also reports console errors and any horizontal overflow.
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:8787";
const paths = (
  process.argv[3] ?? "/,/about,/services,/book,/contact,/book/status?state=confirmed,/missing-page"
).split(",");
const widths = [375, 768, 1280];

await mkdir(".screenshots", { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 812 : 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  for (const path of paths) {
    const res = await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const slug = path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
    await page.screenshot({ path: `.screenshots/${slug}-${width}.png`, fullPage: true });
    const flag = overflow > 0 ? `  OVERFLOW ${overflow}px` : "";
    if (overflow > 0) problems++;
    console.log(`${res?.status()} ${path} @${width}${flag}`);
  }
  if (errors.length) {
    problems += errors.length;
    console.log(`Console errors @${width}:`, errors);
  }
  await context.close();
}

await browser.close();
console.log(problems ? `${problems} problem(s) found` : "No console errors or overflow");
