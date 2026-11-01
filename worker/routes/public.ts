import { Hono } from "hono";
import { z } from "zod";
import { contactSchema } from "../../lib/validation/contact";
import { detailsSchema } from "../../lib/validation/booking";
import type { AppContext } from "../env";
import {
  activeServices,
  bookingSettings,
  freeSlots,
  publicService,
  serviceBySlug,
  unitsFor,
} from "../lib/data";
import { layout, sendMail } from "../lib/email";
import { bookingRef, fail, readJson, requireSameOrigin } from "../lib/http";
import { rateLimit } from "../lib/rate-limit";
import { isIsoDate, MINUTE, parseHhmm, timeLabel } from "../lib/time";
import { verifyTurnstile } from "../lib/turnstile";

export const publicRoutes = new Hono<AppContext>();

publicRoutes.get("/services", async (c) => {
  const services = await activeServices(c.env.DB);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ services: services.map(publicService) });
});

publicRoutes.get("/slots", async (c) => {
  await rateLimit(c, "slots", 120, 60);
  const slug = c.req.query("service") ?? "";
  const date = c.req.query("date") ?? "";
  if (!isIsoDate(date)) fail(400, "Choose a valid date");
  const service = await serviceBySlug(c.env.DB, slug);
  if (!service) fail(404, "Reading not found");
  const settings = await bookingSettings(c.env.DB);
  const slots = await freeSlots(c.env.DB, date, service.duration_min ?? settings.slotMinutes);
  return c.json({ date, slots: slots.map(({ value, label }) => ({ value, label })) });
});

publicRoutes.post("/contact", async (c) => {
  requireSameOrigin(c);
  await rateLimit(c, "contact", 5, 3600);
  const body = (await readJson(c)) as Record<string, unknown>;
  await verifyTurnstile(c, body.turnstileToken);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) fail(400, "Please check the form and try again");
  const v = parsed.data;

  await c.env.DB.prepare(
    "INSERT INTO enquiries (name, email, phone, message, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(v.name, v.email, v.phone, v.message, Date.now())
    .run();

  c.executionCtx.waitUntil(
    sendMail(c.env, {
      kind: "enquiry",
      to: c.env.NOTIFY_EMAIL,
      replyTo: v.email,
      subject: `New message from ${v.name}`,
      html: layout("New message", [
        ["Name", v.name],
        ["Email", v.email],
        ["Phone", v.phone || "Not given"],
        ["Message", v.message],
      ]),
    }),
  );
  return c.json({ ok: true }, 201);
});

const bookingInput = z.object({
  service: z.string().max(60),
  format: z.enum(["call", "text"]),
  date: z.string().refine(isIsoDate),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  agreed: z.literal(true),
  details: z.unknown(),
  turnstileToken: z.string().optional(),
});

/**
 * Holds a slot for the client while they pay. The hold lasts `hold_minutes`
 * (15 by default); payment (phase 7) turns it into a confirmed booking.
 */
publicRoutes.post("/bookings", async (c) => {
  requireSameOrigin(c);
  await rateLimit(c, "booking", 10, 3600);
  const raw = await readJson(c);
  const input = bookingInput.safeParse(raw);
  if (!input.success) fail(400, "Please check your booking and try again");
  const b = input.data;
  await verifyTurnstile(c, b.turnstileToken);

  const service = await serviceBySlug(c.env.DB, b.service);
  if (!service) fail(404, "Reading not found");
  if (!service.formats.split(",").includes(b.format)) fail(400, "That session type isn't offered");

  const details = detailsSchema(service.category === "astrology").safeParse(b.details);
  if (!details.success) fail(400, "Please check your details and try again");
  const d = details.data;

  const settings = await bookingSettings(c.env.DB);
  const duration = service.duration_min ?? settings.slotMinutes;
  const slots = await freeSlots(c.env.DB, b.date, duration);
  const slot = slots.find((s) => s.value === b.time);
  if (!slot) fail(409, "That time is no longer free. Please choose another.");

  const now = Date.now();
  const id = bookingRef();
  const holdUntil = now + settings.holdMinutes * MINUTE;
  const units = unitsFor(slot.startAt, duration);
  const answers =
    service.category === "astrology"
      ? {
          birthDate: d.birthDate,
          birthTime: d.birthTimeUnknown ? null : d.birthTime,
          birthTimeApprox: d.birthTimeUnknown ? d.birthTimeApprox : null,
          birthPlace: d.birthPlace,
        }
      : {};
  const snapshot = JSON.stringify({
    slug: service.slug,
    name: service.name,
    category: service.category,
    durationMin: duration,
    pricePaise: service.price_paise,
  });

  const db = c.env.DB;
  try {
    // One transaction: free blocks left by lapsed holds, add the booking, claim its
    // blocks. If another client claimed a block first, the primary key fails and
    // nothing is written.
    await db.batch([
      db
        .prepare(
          `DELETE FROM booking_slot_units WHERE unit_start IN (SELECT value FROM json_each(?1))
           AND booking_id IN (SELECT id FROM bookings WHERE status = 'held' AND hold_expires_at <= ?2)`,
        )
        .bind(JSON.stringify(units), now),
      db
        .prepare(
          `INSERT INTO bookings (id, service_id, service_snapshot, session_format, start_at, end_at, status,
             hold_expires_at, client_name, client_email, client_phone, topic, question, answers_json,
             amount_paise, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'held', ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)`,
        )
        .bind(
          id,
          service.id,
          snapshot,
          b.format,
          slot.startAt,
          slot.startAt + duration * MINUTE,
          holdUntil,
          d.name,
          d.email,
          d.phone,
          d.topic,
          d.question,
          JSON.stringify(answers),
          service.price_paise,
          now,
        ),
      ...units.map((u) =>
        db.prepare("INSERT INTO booking_slot_units (unit_start, booking_id) VALUES (?1, ?2)").bind(u, id),
      ),
    ]);
  } catch {
    fail(409, "That time was just taken. Please choose another.");
  }

  return c.json(
    {
      reference: id,
      status: "held",
      holdExpiresAt: holdUntil,
      time: `${timeLabel(parseHhmm(b.time) ?? 0)} IST`,
      // Online payment (Razorpay) is connected in phase 7.
      payment: { available: false },
    },
    201,
  );
});

/** Booking status for the /book/status page. Only non-personal fields. */
publicRoutes.get("/bookings/:ref", async (c) => {
  await rateLimit(c, "status", 30, 60);
  const ref = c.req.param("ref");
  if (!/^TS-[A-Z0-9]{8}$/.test(ref)) fail(404, "Booking not found");
  const row = await c.env.DB.prepare(
    "SELECT status, start_at, hold_expires_at, service_snapshot, session_format FROM bookings WHERE id = ?1",
  )
    .bind(ref)
    .first<{
      status: string;
      start_at: number;
      hold_expires_at: number | null;
      service_snapshot: string;
      session_format: string;
    }>();
  if (!row) fail(404, "Booking not found");
  const expired = row.status === "held" && (row.hold_expires_at ?? 0) <= Date.now();
  const snap = JSON.parse(row.service_snapshot) as { name: string };
  return c.json({
    reference: ref,
    status: expired ? "expired" : row.status,
    service: snap.name,
    format: row.session_format,
    startAt: row.start_at,
  });
});
