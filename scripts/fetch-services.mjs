// Before each build, saves the live plan list from the production API to
// content/services.live.json, so the home and Services pages show the plans
// Satakshi manages in the admin. "Publish to website" in the admin triggers a
// build, which runs this. If the API can't be reached, the last saved file (or
// the sample list in content/services.ts) is used, so a build never fails here.
import { writeFile } from "node:fs/promises";

const origin = process.env.SITE_ORIGIN ?? "https://tarot-by-satakshi.peheltheonlinestore.workers.dev";

try {
  const res = await fetch(`${origin}/api/services`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { services } = await res.json();
  if (!Array.isArray(services)) throw new Error("bad response");
  await writeFile("content/services.live.json", `${JSON.stringify(services, null, 2)}\n`);
  console.log(`fetch-services: saved ${services.length} plans from ${origin}`);
} catch (err) {
  console.warn(`fetch-services: kept the saved list (${err instanceof Error ? err.message : err})`);
}
