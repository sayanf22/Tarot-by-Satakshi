import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

// API Worker. Only /api/* runs here (see run_worker_first in wrangler.jsonc);
// every page is served by Cloudflare as a static asset.
const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", secureHeaders());
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true }));

// Routes for slots, bookings, payments and the admin are added in phase 4+.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Non-navigation requests that don't match a file reach the Worker;
// hand them back to the asset server so they get the site's 404 page.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  // Log the message only: never request bodies, secrets or client details.
  console.error("Unhandled API error:", err instanceof Error ? err.message : "unknown");
  return c.json({ error: "Something went wrong" }, 500);
});

export default app;
