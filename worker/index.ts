import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AppContext, AppEnv } from "./env";
import { maintenance } from "./lib/bookings";
import { KEY_PATTERN, shardDb } from "./lib/media";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";

// API Worker. Only /api/* and /media/* run here (see run_worker_first in
// wrangler.jsonc); every page is served by Cloudflare as a static asset.
const app = new Hono<AppContext>();

// Never serve the API or images over plain HTTP: send the client to HTTPS
// (308 keeps the method). Pages get the same from "Always Use HTTPS" once the
// custom domain is on Cloudflare; until then HSTS upgrades repeat visits.
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === "http:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    url.protocol = "https:";
    return c.redirect(url.toString(), 308);
  }
  await next();
});

function ping(db: D1Database) {
  return db
    .prepare("SELECT 1 AS ok")
    .first<{ ok: number }>()
    .then((r) => r?.ok === 1)
    .catch(() => false);
}

app.use(
  "/api/*",
  secureHeaders({
    crossOriginResourcePolicy: "same-origin",
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  }),
);
app.use("/api/*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
});

app.get("/api/health", async (c) => {
  // Confirms each database answers, without exposing anything about them.
  const [db, logs, ...media] = await Promise.all([
    ping(c.env.DB),
    ping(c.env.LOGS),
    ping(c.env.MEDIA_1),
    ping(c.env.MEDIA_2),
    ping(c.env.MEDIA_3),
    ping(c.env.MEDIA_4),
  ]);
  const ok = db && logs && media.every(Boolean);
  return c.json({ ok, db, logs, media: media.filter(Boolean).length }, ok ? 200 : 503);
});

app.route("/api/admin", adminRoutes);
app.route("/api", publicRoutes);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Uploaded images, served from the MEDIA databases. Keys are random and never
// reused, so browsers and Cloudflare may cache them for a year.
app.get("/media/:key", async (c) => {
  const key = c.req.param("key");
  if (!KEY_PATTERN.test(key)) return c.env.ASSETS.fetch(c.req.raw);
  const cache = caches.default;
  const hit = await cache.match(c.req.raw);
  if (hit) return hit;
  const index = await c.env.DB.prepare("SELECT shard FROM media WHERE key = ?1")
    .bind(key)
    .first<{ shard: number }>();
  if (!index) return c.env.ASSETS.fetch(c.req.raw);
  const blob = await shardDb(c.env, index.shard)
    .prepare("SELECT content_type, data FROM media_blobs WHERE key = ?1")
    .bind(key)
    .first<{ content_type: string; data: number[] | ArrayBuffer }>();
  if (!blob) return c.env.ASSETS.fetch(c.req.raw);
  const bytes = blob.data instanceof ArrayBuffer ? new Uint8Array(blob.data) : Uint8Array.from(blob.data);
  const res = new Response(bytes, {
    headers: {
      "Content-Type": blob.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-site",
    },
  });
  // The edge copy lives one day, so a deleted image disappears everywhere within a day
  // (it's purged at once in the data centre that handles the delete).
  const edge = new Response(bytes, res);
  edge.headers.set("Cache-Control", "public, max-age=86400");
  c.executionCtx.waitUntil(cache.put(c.req.raw, edge));
  return res;
});

// Non-navigation requests that don't match a file reach the Worker;
// hand them back to the asset server so they get the site's 404 page.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  // Log the message only: never request bodies, secrets or client details.
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled",
      error: err instanceof Error ? err.message : "unknown",
      path: new URL(c.req.url).pathname,
    }),
  );
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      maintenance(env, ctx).catch((err) =>
        console.error(
          JSON.stringify({
            level: "error",
            msg: "cron failed",
            error: err instanceof Error ? err.message : "unknown",
          }),
        ),
      ),
    );
  },
} satisfies ExportedHandler<AppEnv>;
