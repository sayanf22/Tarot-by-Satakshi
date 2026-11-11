import type { AppEnv } from "../env";
import { audit } from "./logs";
import { MINUTE } from "./time";

// The home, Services and Pricing pages are static files, built with the plan list of the
// moment so search engines and slow phones see the plans straight away. The browser also
// loads the live list, so a saved plan shows on the next page load either way.
// When a plan changes, the static files are rebuilt on their own: the change is noted here,
// and the 10-minute cron starts one Workers Build for any number of changes. Nobody has
// to press a "Publish" button.

const CHANGED = "site_changed_at";
const PUBLISHED = "site_published_at";
/** Let a burst of edits finish before rebuilding. */
const SETTLE_MS = 1 * MINUTE;
/** A build takes about 2 minutes; never start a second one while the first may still run. */
const BUILD_GAP_MS = 5 * MINUTE;

async function setting(db: D1Database, key: string) {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?1")
    .bind(key)
    .first<{ value: string }>();
  const n = Number(row?.value);
  return Number.isFinite(n) ? n : 0;
}

async function put(db: D1Database, key: string, value: number) {
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2")
    .bind(key, String(value))
    .run();
}

export async function markSiteChanged(env: AppEnv) {
  await put(env.DB, CHANGED, Date.now());
}

/** Starts a Workers Build through the deploy hook. True when Cloudflare accepted it. */
export async function startBuild(env: AppEnv) {
  const hook = env.DEPLOY_HOOK_URL;
  if (!hook || !hook.startsWith("https://api.cloudflare.com/")) return false;
  try {
    const res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  await put(env.DB, PUBLISHED, Date.now());
  return true;
}

/** Cron: rebuild the static pages once the latest plan change has settled. */
export async function publishIfChanged(env: AppEnv, now = Date.now()) {
  const [changed, published] = await Promise.all([setting(env.DB, CHANGED), setting(env.DB, PUBLISHED)]);
  if (!changed || changed <= published) return "up-to-date";
  if (now - changed < SETTLE_MS || now - published < BUILD_GAP_MS) return "waiting";
  const ok = await startBuild(env);
  if (ok) await audit(env, "cron", "site.publish", "", "plans changed");
  return ok ? "started" : "failed";
}

/** For the admin: are the static pages up to date with the plans? */
export async function publishState(env: AppEnv) {
  const [changed, published] = await Promise.all([setting(env.DB, CHANGED), setting(env.DB, PUBLISHED)]);
  return {
    auto: Boolean(env.DEPLOY_HOOK_URL),
    pending: changed > published,
    lastBuildAt: published || null,
  };
}
