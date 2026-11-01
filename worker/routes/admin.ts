import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../env";
import { adminConfigured, login, logout, requireAdmin } from "../lib/auth";
import { randomToken } from "../lib/crypto";
import type { ServiceRow } from "../lib/data";
import { fail, readJson, readText } from "../lib/http";
import { audit } from "../lib/logs";
import { KEY_PATTERN, MAX_IMAGE_BYTES, pickShard, shardDb, sniffImage, storageUse } from "../lib/media";
import { refundPayment } from "../lib/razorpay";
import { rateLimit } from "../lib/rate-limit";
import { isIsoDate } from "../lib/time";

export const adminRoutes = new Hono<AppContext>();

function first<T>(r: D1Result<unknown> | undefined) {
  return (r?.results?.[0] ?? {}) as T;
}
const actor = (c: { get: (k: "adminEmail") => string }) => c.get("adminEmail");

// ---- Sign-in (open) ----

adminRoutes.get("/status", (c) => c.json({ configured: adminConfigured(c) }));

adminRoutes.post("/login", async (c) => {
  await rateLimit(c, "RL_LOGIN", "login");
  const body = z
    .object({ password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/) })
    .safeParse(await readJson(c, 2048));
  if (!body.success) fail(400, "Enter your password and the 6-digit code");
  await login(c, body.data.password, body.data.code);
  await audit(c.env, "admin", "signed_in");
  return c.json({ ok: true });
});

// ---- Everything below needs a session ----

adminRoutes.use("*", requireAdmin);

adminRoutes.post("/logout", async (c) => {
  const everywhere = c.req.query("everywhere") === "1";
  await logout(c, everywhere);
  await audit(c.env, actor(c), everywhere ? "signed_out_everywhere" : "signed_out");
  return c.json({ ok: true });
});

adminRoutes.get("/me", (c) => c.json({ user: actor(c) }));

adminRoutes.get("/overview", async (c) => {
  const now = Date.now();
  const ist = new Date(now + 330 * 60_000);
  const monthStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000;
  const dayStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000;
  const db = c.env.DB;
  const [upcoming, today, revenue, messages, plans, next] = await db.batch([
    db.prepare("SELECT count(*) AS n FROM bookings WHERE status = 'confirmed' AND start_at >= ?1").bind(now),
    db
      .prepare(
        "SELECT count(*) AS n FROM bookings WHERE status IN ('confirmed', 'completed') AND start_at BETWEEN ?1 AND ?2",
      )
      .bind(dayStart, dayStart + 86_400_000),
    db
      .prepare(
        "SELECT coalesce(sum(amount_paise - refunded_paise), 0) AS n, count(*) AS c FROM payments WHERE status IN ('paid', 'refunded') AND updated_at >= ?1",
      )
      .bind(monthStart),
    db.prepare("SELECT count(*) AS n FROM enquiries WHERE status = 'new'"),
    db.prepare("SELECT count(*) AS n FROM services WHERE archived = 0"),
    db
      .prepare(
        `SELECT id, service_snapshot, session_format, start_at, client_name FROM bookings
       WHERE status = 'confirmed' AND start_at >= ?1 ORDER BY start_at LIMIT 5`,
      )
      .bind(now),
  ]);
  return c.json({
    upcoming: first<{ n: number }>(upcoming).n ?? 0,
    today: first<{ n: number }>(today).n ?? 0,
    revenueMonthPaise: first<{ n: number }>(revenue).n ?? 0,
    paymentsMonth: first<{ c: number }>(revenue).c ?? 0,
    newMessages: first<{ n: number }>(messages).n ?? 0,
    plans: first<{ n: number }>(plans).n ?? 0,
    next: next?.results ?? [],
    storage: await storageUse(c.env),
    payments: Boolean(c.env.RAZORPAY_KEY_ID && c.env.RAZORPAY_KEY_SECRET && c.env.RAZORPAY_WEBHOOK_SECRET),
    email: Boolean(c.env.RESEND_API_KEY && c.env.EMAIL_FROM),
    publish: Boolean(c.env.DEPLOY_HOOK_URL),
  });
});

// ---- Bookings ----

adminRoutes.get("/bookings", async (c) => {
  const scope = c.req.query("scope") ?? "upcoming";
  const now = Date.now();
  const where =
    scope === "past"
      ? "b.start_at < ?1 AND b.status IN ('confirmed', 'completed', 'cancelled', 'refunded')"
      : scope === "attention"
        ? "b.status IN ('refunded') OR p.status = 'refund_pending'"
        : "b.start_at >= ?1 AND b.status IN ('confirmed', 'held')";
  const order = scope === "past" ? "DESC" : "ASC";
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.service_snapshot, b.session_format, b.start_at, b.end_at, b.status, b.hold_expires_at,
            b.client_name, b.client_email, b.client_phone, b.amount_paise, p.status AS payment_status
     FROM bookings b LEFT JOIN payments p ON p.booking_id = b.id
     WHERE ${where} ORDER BY b.start_at ${order} LIMIT 200`,
  )
    .bind(now)
    .all();
  return c.json({ bookings: results });
});

adminRoutes.get("/bookings/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT b.*, p.gateway_order_id, p.gateway_payment_id, p.status AS payment_status, p.method, p.refunded_paise, p.refund_id
     FROM bookings b LEFT JOIN payments p ON p.booking_id = b.id WHERE b.id = ?1`,
  )
    .bind(c.req.param("id"))
    .first();
  if (!row) fail(404, "Booking not found");
  return c.json({ booking: row });
});

adminRoutes.patch("/bookings/:id", async (c) => {
  const body = z
    .object({
      action: z.enum(["complete", "cancel", "reopen", "note"]),
      note: z.string().max(1000).optional(),
    })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Invalid request");
  const id = c.req.param("id");
  const now = Date.now();
  const db = c.env.DB;
  const { action, note } = body.data;
  let res: D1Result;
  if (action === "note") {
    res = await db
      .prepare("UPDATE bookings SET admin_note = ?1, updated_at = ?2 WHERE id = ?3")
      .bind(note ?? "", now, id)
      .run();
  } else if (action === "complete") {
    res = await db
      .prepare(
        "UPDATE bookings SET status = 'completed', updated_at = ?1 WHERE id = ?2 AND status = 'confirmed'",
      )
      .bind(now, id)
      .run();
  } else if (action === "reopen") {
    res = await db
      .prepare(
        "UPDATE bookings SET status = 'confirmed', updated_at = ?1 WHERE id = ?2 AND status = 'completed'",
      )
      .bind(now, id)
      .run();
  } else {
    // Cancelling frees the time. Money is not returned unless "Refund" is used.
    const [r] = await db.batch([
      db
        .prepare(
          "UPDATE bookings SET status = 'cancelled', updated_at = ?1 WHERE id = ?2 AND status IN ('confirmed', 'held')",
        )
        .bind(now, id),
      db.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(id),
    ]);
    res = r!;
  }
  if (!res.meta.changes) fail(409, "This booking can't be changed that way");
  await audit(c.env, actor(c), `booking.${action}`, id);
  return c.json({ ok: true });
});

adminRoutes.post("/bookings/:id/refund", async (c) => {
  const body = z
    .object({ amountPaise: z.number().int().min(100).optional(), reason: z.string().max(200).default("") })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Invalid amount");
  const id = c.req.param("id");
  const p = await c.env.DB.prepare(
    "SELECT gateway_payment_id, amount_paise, refunded_paise, status FROM payments WHERE booking_id = ?1",
  )
    .bind(id)
    .first<{
      gateway_payment_id: string | null;
      amount_paise: number;
      refunded_paise: number;
      status: string;
    }>();
  if (!p?.gateway_payment_id || p.status !== "paid") fail(409, "Only a paid booking can be refunded");
  const amount = body.data.amountPaise ?? p.amount_paise - p.refunded_paise;
  if (amount > p.amount_paise - p.refunded_paise) fail(400, "That is more than was paid");
  // Mark first, so a double click can't refund twice.
  const lock = await c.env.DB.prepare(
    "UPDATE payments SET status = 'refund_pending', updated_at = ?1 WHERE booking_id = ?2 AND status = 'paid'",
  )
    .bind(Date.now(), id)
    .run();
  if (!lock.meta.changes) fail(409, "A refund is already in progress");
  try {
    const refund = await refundPayment(
      c.env,
      p.gateway_payment_id,
      amount,
      body.data.reason || "Refund by Tarot by Satakshi",
    );
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE payments SET status = 'refunded', refund_id = ?1, refunded_paise = refunded_paise + ?2, updated_at = ?3 WHERE booking_id = ?4",
      ).bind(refund.id, refund.amount, now, id),
      c.env.DB.prepare("UPDATE bookings SET status = 'refunded', updated_at = ?1 WHERE id = ?2").bind(
        now,
        id,
      ),
      c.env.DB.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(id),
    ]);
  } catch (err) {
    await c.env.DB.prepare(
      "UPDATE payments SET status = 'paid' WHERE booking_id = ?1 AND status = 'refund_pending'",
    )
      .bind(id)
      .run();
    console.error("refund failed", err instanceof Error ? err.message : "");
    fail(502, "Razorpay didn't accept the refund. Please try again or refund from the Razorpay dashboard.");
  }
  await audit(c.env, actor(c), "booking.refund", id, `${amount} paise`);
  return c.json({ ok: true });
});

// ---- Messages ----

adminRoutes.get("/enquiries", async (c) => {
  const archived = c.req.query("archived") === "1";
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM enquiries WHERE status ${archived ? "= 'archived'" : "!= 'archived'"} ORDER BY created_at DESC LIMIT 200`,
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

adminRoutes.delete("/enquiries/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) fail(400, "Invalid request");
  await c.env.DB.prepare("DELETE FROM enquiries WHERE id = ?1").bind(id).run();
  await audit(c.env, actor(c), "enquiry.delete", String(id));
  return c.json({ ok: true });
});

// ---- Plans (services) ----

const planFields = z.object({
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
  pricePaise: z.number().int().min(100).max(50_000_000).nullable(),
  sample: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  imageKey: z.string().regex(KEY_PATTERN).nullable(),
});

adminRoutes.get("/services", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, (SELECT count(*) FROM bookings b WHERE b.service_id = s.id) AS booking_count
     FROM services s ORDER BY s.archived, s.sort_order, s.id`,
  ).all<ServiceRow & { booking_count: number }>();
  return c.json({ services: results });
});

adminRoutes.post("/services", async (c) => {
  const body = planFields
    .extend({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/) })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the plan details");
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
    fail(409, "A plan with that web address already exists");
  }
  await audit(c.env, actor(c), "plan.create", s.slug);
  return c.json({ ok: true }, 201);
});

adminRoutes.put("/services/:slug", async (c) => {
  const body = planFields.safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the plan details");
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
  if (!res.meta.changes) fail(404, "Plan not found");
  await audit(c.env, actor(c), "plan.update", c.req.param("slug"));
  return c.json({ ok: true });
});

/** Archive hides a plan everywhere but keeps it for past bookings; restore brings it back. */
adminRoutes.patch("/services/:slug", async (c) => {
  const body = z.object({ archived: z.boolean() }).safeParse(await readJson(c));
  if (!body.success) fail(400, "Invalid request");
  const res = await c.env.DB.prepare("UPDATE services SET archived = ?1, updated_at = ?2 WHERE slug = ?3")
    .bind(body.data.archived ? 1 : 0, Date.now(), c.req.param("slug"))
    .run();
  if (!res.meta.changes) fail(404, "Plan not found");
  await audit(c.env, actor(c), body.data.archived ? "plan.archive" : "plan.restore", c.req.param("slug"));
  return c.json({ ok: true });
});

/** Deleting is allowed only for plans that were never booked; others can be archived. */
adminRoutes.delete("/services/:slug", async (c) => {
  const slug = c.req.param("slug");
  const res = await c.env.DB.prepare(
    "DELETE FROM services WHERE slug = ?1 AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.service_id = services.id)",
  )
    .bind(slug)
    .run();
  if (!res.meta.changes) fail(409, "This plan has bookings, so it can only be archived");
  await audit(c.env, actor(c), "plan.delete", slug);
  return c.json({ ok: true });
});

// ---- Hours, days off, booking settings ----

const minutes = z.number().int().min(0).max(1440);

adminRoutes.get("/availability", async (c) => {
  const db = c.env.DB;
  const [rules, overrides, settings] = await db.batch([
    db.prepare("SELECT weekday, enabled, open_min, close_min FROM availability_rules ORDER BY weekday"),
    db.prepare(
      "SELECT * FROM availability_overrides WHERE date >= date('now', '-1 day') ORDER BY date LIMIT 200",
    ),
    db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('slot_minutes', 'min_notice_minutes', 'window_days', 'hold_minutes')",
    ),
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
  await audit(c.env, actor(c), "hours.update");
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
    .bind(date, o.closed ? 1 : 0, o.closed ? null : o.openMin, o.closed ? null : o.closeMin, o.note)
    .run();
  await audit(c.env, actor(c), "dayoff.set", date);
  return c.json({ ok: true });
});

adminRoutes.delete("/availability/overrides/:date", async (c) => {
  await c.env.DB.prepare("DELETE FROM availability_overrides WHERE date = ?1")
    .bind(c.req.param("date"))
    .run();
  await audit(c.env, actor(c), "dayoff.remove", c.req.param("date"));
  return c.json({ ok: true });
});

adminRoutes.put("/settings", async (c) => {
  const body = z
    .object({
      slot_minutes: z.number().int().min(15).max(240).multipleOf(15),
      min_notice_minutes: z.number().int().min(0).max(10_080),
      window_days: z.number().int().min(1).max(180),
      hold_minutes: z.number().int().min(5).max(30),
    })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Please check the settings");
  const db = c.env.DB;
  await db.batch(
    Object.entries(body.data).map(([k, v]) =>
      db
        .prepare(
          "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
        )
        .bind(k, String(v)),
    ),
  );
  await audit(c.env, actor(c), "settings.update", "", JSON.stringify(body.data));
  return c.json({ ok: true });
});

// ---- Images (stored in the MEDIA databases) ----

adminRoutes.get("/media", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT key, content_type, size, alt, created_at FROM media ORDER BY created_at DESC LIMIT 500",
  ).all();
  return c.json({ media: results, storage: await storageUse(c.env) });
});

adminRoutes.post("/media", async (c) => {
  const type = (c.req.header("Content-Type") ?? "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type))
    fail(415, "Upload a JPEG, PNG or WebP image");
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) fail(413, "Images must be under 1.9 MB");
  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (!buf.byteLength || buf.byteLength > MAX_IMAGE_BYTES) fail(413, "Images must be under 1.9 MB");
  const kind = sniffImage(buf);
  if (!kind || kind.type !== type) fail(415, "Upload a JPEG, PNG or WebP image");
  const shard = await pickShard(c.env, buf.byteLength);
  if (!shard) fail(507 as 503, "Image storage is full. Delete some images first.");
  const key = `${randomToken(15)}.${kind.ext}`;
  const alt = (c.req.query("alt") ?? "").slice(0, 200);
  const now = Date.now();
  await shardDb(c.env, shard)
    .prepare(
      "INSERT INTO media_blobs (key, content_type, size, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(key, kind.type, buf.byteLength, buf, now)
    .run();
  try {
    await c.env.DB.prepare(
      "INSERT INTO media (key, shard, content_type, size, alt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
      .bind(key, shard, kind.type, buf.byteLength, alt, now)
      .run();
  } catch (err) {
    // Keep the two databases in step: undo the blob if the index row failed.
    await shardDb(c.env, shard).prepare("DELETE FROM media_blobs WHERE key = ?1").bind(key).run();
    throw err;
  }
  await audit(c.env, actor(c), "image.upload", key, `${buf.byteLength} bytes`);
  return c.json({ key, url: `/media/${key}` }, 201);
});

adminRoutes.delete("/media/:key", async (c) => {
  const key = c.req.param("key");
  if (!KEY_PATTERN.test(key)) fail(404, "Image not found");
  const row = await c.env.DB.prepare("SELECT shard FROM media WHERE key = ?1")
    .bind(key)
    .first<{ shard: number }>();
  if (!row) fail(404, "Image not found");
  const inUse = await c.env.DB.prepare("SELECT slug FROM services WHERE image_key = ?1 LIMIT 1")
    .bind(key)
    .first();
  if (inUse) fail(409, "A plan uses this image. Change the plan's image first.");
  await shardDb(c.env, row.shard).prepare("DELETE FROM media_blobs WHERE key = ?1").bind(key).run();
  await c.env.DB.prepare("DELETE FROM media WHERE key = ?1").bind(key).run();
  await caches.default.delete(new Request(`${new URL(c.req.url).origin}/media/${key}`));
  await audit(c.env, actor(c), "image.delete", key);
  return c.json({ ok: true });
});

// ---- Publish: rebuild the static pages so new or changed plans show everywhere ----

adminRoutes.post("/publish", async (c) => {
  const hook = c.env.DEPLOY_HOOK_URL;
  if (!hook || !hook.startsWith("https://api.cloudflare.com/")) fail(503, "Publishing isn't set up yet");
  await readText(c, 1024);
  const res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(8000) });
  if (!res.ok) fail(502, "The website couldn't be rebuilt right now. Please try again.");
  await audit(c.env, actor(c), "site.publish");
  return c.json({ ok: true });
});

adminRoutes.get("/activity", async (c) => {
  const { results } = await c.env.LOGS.prepare(
    "SELECT at, actor, action, target FROM audit_log ORDER BY at DESC LIMIT 100",
  ).all();
  return c.json({ activity: results });
});
