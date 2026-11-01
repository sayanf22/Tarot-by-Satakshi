import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AppContext } from "./env";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";

// API Worker. Only /api/* and /media/* run here (see run_worker_first in
// wrangler.jsonc); every page is served by Cloudflare as a static asset.
const app = new Hono<AppContext>();

app.use("/api/*", secureHeaders({ crossOriginResourcePolicy: "same-origin" }));
app.use("/api/*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
});

app.get("/api/health", async (c) => {
  // Confirms the database answers, without exposing anything about it.
  const db = await c.env.DB.prepare("SELECT 1 AS ok")
    .first<{ ok: number }>()
    .catch(() => null);
  return c.json({ ok: db?.ok === 1, storage: Boolean(c.env.MEDIA) });
});

app.route("/api/admin", adminRoutes);
app.route("/api", publicRoutes);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Uploaded images, served from R2 with a long cache (keys are random and never reused).
app.get("/media/:key", async (c) => {
  const key = c.req.param("key");
  const bucket = c.env.MEDIA;
  if (!bucket || !/^[A-Za-z0-9_-]{8,40}\.(jpg|png|webp)$/.test(key)) return c.env.ASSETS.fetch(c.req.raw);
  const object = await bucket.get(key);
  if (!object) return c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  return new Response(object.body, { headers });
});

// Non-navigation requests that don't match a file reach the Worker;
// hand them back to the asset server so they get the site's 404 page.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  // Log the message only: never request bodies, secrets or client details.
  console.error("Unhandled API error:", err instanceof Error ? err.message : "unknown");
  return c.json({ error: "Something went wrong" }, 500);
});

export default app;
