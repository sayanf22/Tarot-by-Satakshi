import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../env";
import { requireAdmin } from "../lib/access";
import type { ServiceRow } from "../lib/data";
import { fail, randomId, readJson, requireSameOrigin } from "../lib/http";
import { isIsoDate } from "../lib/time";

// Everything here needs a valid Cloudflare Access token for an admin email.
// Changes also need a same-origin request, so another site can't post with her session.
export const adminRoutes = new Hono<AppContext>();

adminRoutes.use("*", requireAdmin);
adminRoutes.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") requireSameOrigin(c);
  await next();
});

adminRoutes.get("/me", (c) => c.json({ email: c.get("adminEmail") }));

// ---- Bookings ----

adminRoutes.get("/bookings", async (c) => {
  const from = Number(c.req.query("from") ?? Date.now() - 30 * 86_400_000);
  const to = Number(c.req.query("to") ?? Date.now() + 90 * 86_400_000);
  if (!Number.isFinite(from) || !Number.isFinite(to)) fail(400, "Invalid range");
  const { results } = await c.env.DB.prepare(
    `SELECT id, service_snapshot, session_format, start_at, end_at, status, hold_expires_at,
            client_name, client_email, client_phone, topic, question, answers_json, amount_paise, created_at
     FROM bookings WHERE start_at BETWEEN ?1 AND ?2 AND status != 'expired'
     ORDER BY start_at LIMIT 500`,
  )
    .bind(from, to)
    .all();
  return c.json({ bookings: results });
});

adminRoutes.patch("/bookings/:id", async (c) => {
  const body = z.object({ status: z.enum(["cancelled", "confirmed"]) }).safeParse(await readJson(c));
  if (!body.success) fail(400, "Invalid status");
  const id = c.req.param("id");
  const db = c.env.DB;
  const now = Date.now();
  const stmts = [
    db
      .prepare("UPDATE bookings SET status = ?1, hold_expires_at = NULL, updated_at = ?2 WHERE id = ?3")
      .bind(body.data.status, now, id),
  ];
  // A cancelled booking frees its time.
  if (body.data.status === "cancelled")
    stmts.push(db.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(id));
  const [res] = await db.batch(stmts);
  if (!res?.meta.changes) fail(404, "Booking not found");
  return c.json({ ok: true });
});

// ---- Enquiries ----

adminRoutes.get("/enquiries", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM enquiries WHERE status != 'archived' ORDER BY created_at DESC LIMIT 200",
  ).all();
  return c.json({ enquiries: results });
});

adminRoutes.patch("/enquiries/:id", async (c) => {
  const body = z.object({ status: z.enum(["new", "read", "archived"]) }).safeParse(await readJson(c));
  const id = Number(c.req.param("id"));
  if (!body.success || !Number.isInteger(id)) fail(400, "Invalid request");
  const res = await c.env.DB.prepare("UPDATE enquiries SET status = ?1 WHERE id = ?2")
    .bind(body.data.status, id)
    .run();
  if (!res.meta.changes) fail(404, "Message not found");
  return c.json({ ok: true });
});

// ---- Services ----

const serviceFields = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(["tarot", "astrology"]),
  summary: z.string().trim().max(300),
  icon: z.enum(["cards", "heart", "sun", "moon", "star", "wheel", "eye"]),
  card: z.enum(["priestess", "two-cups", "ace-pentacles", "wheel", "hermit", "moon"]),
  formats: z
    .array(z.enum(["call", "text"]))
    .min(1)
    .max(2),
  durationMin: z.number().int().min(10).max(240).nullable(),
  pricePaise: z.number().int().min(100).max(10_000_000).nullable(),
  sample: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  imageKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,40}\.(jpg|png|webp)$/)
    .nullable(),
});

adminRoutes.get("/services", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM services ORDER BY sort_order, id",
  ).all<ServiceRow>();
  return c.json({ services: results });
});

adminRoutes.post("/services", async (c) => {
  const body = serviceFields
    .extend({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/) })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the service details");
  const s = body.data;
  const now = Date.now();
  try {
    await c.env.DB.prepare(
      `INSERT INTO services (slug, name, category, summary, icon, card, formats, duration_min, price_paise,
         is_sample, active, sort_order, image_key, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)`,
    )
      .bind(
        s.slug,
        s.name,
        s.category,
        s.summary,
        s.icon,
        s.card,
        s.formats.join(","),
        s.durationMin,
        s.pricePaise,
        s.sample ? 1 : 0,
        s.active ? 1 : 0,
        s.sortOrder,
        s.imageKey,
        now,
      )
      .run();
  } catch {
    fail(409, "A service with that link name already exists");
  }
  return c.json({ ok: true }, 201);
});

adminRoutes.put("/services/:slug", async (c) => {
  const body = serviceFields.safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the service details");
  const s = body.data;
  const res = await c.env.DB.prepare(
    `UPDATE services SET name = ?1, category = ?2, summary = ?3, icon = ?4, card = ?5, formats = ?6,
       duration_min = ?7, price_paise = ?8, is_sample = ?9, active = ?10, sort_order = ?11, image_key = ?12,
       updated_at = ?13 WHERE slug = ?14`,
  )
    .bind(
      s.name,
      s.category,
      s.summary,
      s.icon,
      s.card,
      s.formats.join(","),
      s.durationMin,
      s.pricePaise,
      s.sample ? 1 : 0,
      s.active ? 1 : 0,
      s.sortOrder,
      s.imageKey,
      Date.now(),
      c.req.param("slug"),
    )
    .run();
  if (!res.meta.changes) fail(404, "Service not found");
  return c.json({ ok: true });
});

// ---- Availability ----

const minutes = z.number().int().min(0).max(1440);

adminRoutes.get("/availability", async (c) => {
  const [rules, overrides, settings] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM availability_rules ORDER BY weekday"),
    c.env.DB.prepare("SELECT * FROM availability_overrides WHERE date >= date('now') ORDER BY date"),
    c.env.DB.prepare("SELECT * FROM settings"),
  ]);
  return c.json({ rules: rules?.results, overrides: overrides?.results, settings: settings?.results });
});

adminRoutes.put("/availability/rules", async (c) => {
  const body = z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        enabled: z.boolean(),
        openMin: minutes,
        closeMin: minutes,
      }),
    )
    .length(7)
    .safeParse(await readJson(c));
  if (!body.success || body.data.some((r) => r.enabled && r.closeMin <= r.openMin))
    fail(400, "Please check the hours");
  const db = c.env.DB;
  await db.batch(
    body.data.map((r) =>
      db
        .prepare(
          "UPDATE availability_rules SET enabled = ?1, open_min = ?2, close_min = ?3 WHERE weekday = ?4",
        )
        .bind(r.enabled ? 1 : 0, r.openMin, r.closeMin, r.weekday),
    ),
  );
  return c.json({ ok: true });
});

adminRoutes.put("/availability/overrides/:date", async (c) => {
  const date = c.req.param("date");
  const body = z
    .object({
      closed: z.boolean(),
      openMin: minutes.nullable(),
      closeMin: minutes.nullable(),
      note: z.string().max(120),
    })
    .safeParse(await readJson(c));
  if (!isIsoDate(date) || !body.success) fail(400, "Please check the date");
  const o = body.data;
  if (!o.closed && (o.openMin == null || o.closeMin == null || o.closeMin <= o.openMin))
    fail(400, "Please check the hours");
  await c.env.DB.prepare(
    `INSERT INTO availability_overrides (date, closed, open_min, close_min, note) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (date) DO UPDATE SET closed = ?2, open_min = ?3, close_min = ?4, note = ?5`,
  )
    .bind(date, o.closed ? 1 : 0, o.openMin, o.closeMin, o.note)
    .run();
  return c.json({ ok: true });
});

adminRoutes.delete("/availability/overrides/:date", async (c) => {
  await c.env.DB.prepare("DELETE FROM availability_overrides WHERE date = ?1")
    .bind(c.req.param("date"))
    .run();
  return c.json({ ok: true });
});

adminRoutes.put("/settings", async (c) => {
  const body = z
    .object({
      slot_minutes: z.number().int().min(15).max(240),
      min_notice_minutes: z.number().int().min(0).max(10_080),
      window_days: z.number().int().min(1).max(180),
      hold_minutes: z.number().int().min(5).max(30),
    })
    .partial()
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the settings");
  const db = c.env.DB;
  const entries = Object.entries(body.data).filter(([, v]) => v !== undefined);
  if (entries.length) {
    await db.batch(
      entries.map(([k, v]) =>
        db
          .prepare(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
          )
          .bind(k, String(v)),
      ),
    );
  }
  return c.json({ ok: true });
});

// ---- Images (R2) ----

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Detects the real image type from the first bytes; SVG and anything else is refused. */
function sniffImage(
  bytes: Uint8Array,
): { type: "image/jpeg" | "image/png" | "image/webp"; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { type: "image/png", ext: "png" };
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

adminRoutes.get("/media", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM media ORDER BY created_at DESC LIMIT 500").all();
  return c.json({ media: results, storage: Boolean(c.env.MEDIA) });
});

adminRoutes.post("/media", async (c) => {
  const bucket = c.env.MEDIA;
  if (!bucket) fail(503, "Image storage isn't set up yet");
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (!declared || declared > MAX_IMAGE_BYTES) fail(413, "Images must be under 5 MB");
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) fail(413, "Images must be under 5 MB");
  const kind = sniffImage(bytes);
  if (!kind) fail(415, "Upload a JPEG, PNG or WebP image");
  const alt = (c.req.query("alt") ?? "").slice(0, 200);

  const key = `${randomId(15)}.${kind.ext}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: kind.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  await c.env.DB.prepare(
    "INSERT INTO media (key, content_type, size, alt, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(key, kind.type, bytes.byteLength, alt, Date.now())
    .run();
  return c.json({ key, url: `/media/${key}` }, 201);
});

adminRoutes.delete("/media/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[A-Za-z0-9_-]{8,40}\.(jpg|png|webp)$/.test(key)) fail(404, "Image not found");
  await c.env.MEDIA?.delete(key);
  await c.env.DB.prepare("DELETE FROM media WHERE key = ?1").bind(key).run();
  return c.json({ ok: true });
});
