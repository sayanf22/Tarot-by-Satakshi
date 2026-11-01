import { Hono } from "hono";
import { z } from "zod";
import { detailsSchema } from "../../lib/validation/booking";
import { contactSchema } from "../../lib/validation/contact";
import type { AppContext } from "../env";
import { settleByPaymentId } from "../lib/bookings";
import { bookingRef } from "../lib/crypto";
import {
  activeServices,
  bookable,
  bookingSettings,
  freeSlots,
  publicService,
  serviceBySlug,
  unitsFor,
} from "../lib/data";
import { layout, sendMail } from "../lib/email";
import { fail, readJson, readText, requireSameOrigin } from "../lib/http";
import { audit, recordPaymentEvent } from "../lib/logs";
import {
  checkoutSignatureValid,
  createOrder,
  paymentsConfigured,
  webhookSignatureValid,
  type RzpPayment,
} from "../lib/razorpay";
import { rateLimit } from "../lib/rate-limit";
import { isIsoDate, MINUTE } from "../lib/time";
import { verifyTurnstile } from "../lib/turnstile";

export const publicRoutes = new Hono<AppContext>();

/** What the booking page needs to know before it starts. */
publicRoutes.get("/config", (c) => c.json({ payments: paymentsConfigured(c.env) }));

publicRoutes.get("/services", async (c) => {
  await rateLimit(c, "RL_READ", "services");
  const services = await activeServices(c.env.DB);
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ services: services.map(publicService) });
});

publicRoutes.get("/slots", async (c) => {
  await rateLimit(c, "RL_READ", "slots");
  const date = c.req.query("date") ?? "";
  if (!isIsoDate(date)) fail(400, "Choose a valid date");
  const service = await serviceBySlug(c.env.DB, c.req.query("service") ?? "");
  if (!service) fail(404, "Reading not found");
  const settings = await bookingSettings(c.env.DB);
  const slots = await freeSlots(c.env.DB, date, service.duration_min ?? settings.slotMinutes);
  return c.json({ date, slots: slots.map(({ value, label }) => ({ value, label })) });
});

publicRoutes.post("/contact", async (c) => {
  requireSameOrigin(c);
  await rateLimit(c, "RL_FORM", "contact");
  const body = (await readJson(c)) as Record<string, unknown>;
  await verifyTurnstile(c, body?.turnstileToken);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) fail(400, "Please check the form and try again");
  const v = parsed.data;
  const res = await c.env.DB.prepare(
    "INSERT INTO enquiries (name, email, phone, message, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(v.name, v.email, v.phone, v.message, Date.now())
    .run();
  c.executionCtx.waitUntil(
    sendMail(c.env, {
      kind: "enquiry",
      to: c.env.NOTIFY_EMAIL,
      ref: `enquiry-${res.meta.last_row_id}`,
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
  turnstileToken: z.string().max(2048).optional(),
});

/**
 * Step 1 of paying: hold the time for 15 minutes and create a Razorpay order for
 * the price stored in D1 (the browser never sends an amount).
 */
publicRoutes.post("/bookings", async (c) => {
  requireSameOrigin(c);
  await rateLimit(c, "RL_FORM", "booking");
  if (!paymentsConfigured(c.env))
    fail(503, "Online payment isn't switched on yet. Please call or message to book.");
  const input = bookingInput.safeParse(await readJson(c));
  if (!input.success) fail(400, "Please check your booking and try again");
  const b = input.data;
  await verifyTurnstile(c, b.turnstileToken);

  const service = await serviceBySlug(c.env.DB, b.service);
  if (!service) fail(404, "Reading not found");
  if (!bookable(service)) fail(409, "This reading can't be booked online yet");
  if (!service.formats.split(",").includes(b.format)) fail(400, "That session type isn't offered");
  const details = detailsSchema(service.category === "astrology").safeParse(b.details);
  if (!details.success) fail(400, "Please check your details and try again");
  const d = details.data;

  const settings = await bookingSettings(c.env.DB);
  const duration = service.duration_min!;
  const amount = service.price_paise!;
  const slot = (await freeSlots(c.env.DB, b.date, duration)).find((s) => s.value === b.time);
  if (!slot) fail(409, "That time is no longer free. Please choose another.");

  const now = Date.now();
  const id = bookingRef();
  const holdUntil = now + settings.holdMinutes * MINUTE;
  const units = unitsFor(slot.startAt, duration);
  const answers =
    service.category === "astrology"
      ? {
          "Date of birth": d.birthDate,
          "Time of birth": d.birthTimeUnknown
            ? `Not known${d.birthTimeApprox ? ` (about ${d.birthTimeApprox})` : ""}`
            : d.birthTime,
          "Place of birth": d.birthPlace,
        }
      : {};
  const snapshot = JSON.stringify({
    slug: service.slug,
    name: service.name,
    category: service.category,
    durationMin: duration,
    pricePaise: amount,
  });

  const db = c.env.DB;
  try {
    // One transaction: free blocks left by lapsed holds, add the booking, claim its
    // blocks. If another client got a block first, the primary key fails and nothing is written.
    await db.batch([
      db
        .prepare(
          `DELETE FROM booking_slot_units WHERE unit_start IN (SELECT value FROM json_each(?1))
           AND booking_id IN (SELECT id FROM bookings WHERE status IN ('held', 'expired') AND hold_expires_at <= ?2)`,
        )
        .bind(JSON.stringify(units), now),
      db
        .prepare(
          `INSERT INTO bookings (id, service_id, service_snapshot, session_format, start_at, end_at, status, hold_expires_at,
             client_name, client_email, client_phone, topic, question, answers_json, amount_paise, created_at, updated_at)
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
          amount,
          now,
        ),
      ...units.map((u) =>
        db.prepare("INSERT INTO booking_slot_units (unit_start, booking_id) VALUES (?1, ?2)").bind(u, id),
      ),
    ]);
  } catch {
    fail(409, "That time was just taken. Please choose another.");
  }

  let orderId: string;
  try {
    const order = await createOrder(c.env, amount, id, { booking: id, service: service.slug });
    orderId = order.id;
    await db
      .prepare(
        `INSERT INTO payments (booking_id, gateway, gateway_order_id, amount_paise, status, created_at, updated_at)
         VALUES (?1, 'razorpay', ?2, ?3, 'created', ?4, ?4)`,
      )
      .bind(id, orderId, amount, now)
      .run();
  } catch (err) {
    // Release the time straight away if the order couldn't be made.
    console.error("order create failed", err instanceof Error ? err.message : "");
    await db.batch([
      db.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(id),
      db.prepare("UPDATE bookings SET status = 'expired', hold_expires_at = ?2 WHERE id = ?1").bind(id, now),
    ]);
    fail(502, "Payment couldn't be started. Please try again in a moment.");
  }

  return c.json(
    {
      reference: id,
      holdExpiresAt: holdUntil,
      checkout: {
        key: c.env.RAZORPAY_KEY_ID,
        orderId,
        amount,
        currency: "INR",
        description: service.name,
        prefill: { name: d.name, email: d.email, contact: d.phone },
        // Close the checkout when the hold runs out.
        timeoutSec: Math.floor((holdUntil - now) / 1000),
      },
    },
    201,
  );
});

/**
 * Step 2: the browser hands back Razorpay's result. The signature is checked with
 * our own order id (from D1, not from the browser), then the payment itself is
 * fetched from Razorpay and must be captured for exactly our amount.
 */
publicRoutes.post("/payments/verify", async (c) => {
  requireSameOrigin(c);
  await rateLimit(c, "RL_READ", "verify");
  if (!paymentsConfigured(c.env)) fail(503, "Online payment isn't switched on yet");
  const body = z
    .object({
      reference: z.string().regex(/^TS-[A-Z0-9]{8}$/),
      razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
      razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
      razorpay_signature: z.string().max(128),
    })
    .safeParse(await readJson(c));
  if (!body.success) fail(400, "Invalid payment details");
  const v = body.data;
  const row = await c.env.DB.prepare("SELECT gateway_order_id FROM payments WHERE booking_id = ?1")
    .bind(v.reference)
    .first<{ gateway_order_id: string }>();
  if (!row || row.gateway_order_id !== v.razorpay_order_id) fail(400, "Invalid payment details");
  if (
    !(await checkoutSignatureValid(c.env, row.gateway_order_id, v.razorpay_payment_id, v.razorpay_signature))
  ) {
    await audit(c.env, "public", "payment.bad_signature", v.reference);
    fail(400, "Invalid payment details");
  }
  const result = await settleByPaymentId(c.env, c.executionCtx, v.razorpay_payment_id, "checkout");
  return c.json({ reference: v.reference, result });
});

/**
 * Step 3 (backstop): Razorpay's webhook, for when the browser closed before step 2.
 * The raw body is verified with the webhook secret before anything is parsed.
 * Events repeat by design (at-least-once), so each is recorded and settling is idempotent.
 */
publicRoutes.post("/payments/webhook", async (c) => {
  if (!paymentsConfigured(c.env)) fail(503, "Not configured");
  const raw = await readText(c, 65_536);
  const signature = c.req.header("X-Razorpay-Signature") ?? "";
  if (!(await webhookSignatureValid(c.env, raw, signature))) fail(400, "Invalid signature");

  const event = JSON.parse(raw) as {
    event: string;
    payload?: {
      payment?: { entity?: RzpPayment };
      refund?: { entity?: { id: string; payment_id: string; amount: number } };
    };
  };
  const eventId =
    c.req.header("X-Razorpay-Event-Id") ?? `${event.event}:${event.payload?.payment?.entity?.id ?? ""}`;
  const payment = event.payload?.payment?.entity;

  let outcome = "ignored";
  if (
    (event.event === "payment.captured" ||
      event.event === "order.paid" ||
      event.event === "payment.authorized") &&
    payment
  ) {
    // Re-fetch rather than trusting the payload's status, then settle.
    outcome = await settleByPaymentId(c.env, c.executionCtx, payment.id, "webhook");
  } else if (event.event === "payment.failed" && payment) {
    await c.env.DB.prepare(
      "UPDATE payments SET status = 'failed', updated_at = ?1 WHERE gateway_order_id = ?2 AND status = 'created'",
    )
      .bind(Date.now(), payment.order_id)
      .run();
    outcome = "failed";
  } else if (event.event === "refund.processed" && event.payload?.refund?.entity) {
    const r = event.payload.refund.entity;
    await c.env.DB.prepare(
      "UPDATE payments SET status = 'refunded', refund_id = ?1, refunded_paise = ?2, updated_at = ?3 WHERE gateway_payment_id = ?4",
    )
      .bind(r.id, r.amount, Date.now(), r.payment_id)
      .run();
    outcome = "refunded";
  }
  await recordPaymentEvent(c.env, {
    id: eventId.slice(0, 120),
    event: event.event,
    orderId: payment?.order_id,
    paymentId: payment?.id,
    outcome,
  });
  return c.json({ ok: true });
});

/** Booking status for /book/status. Only non-personal fields. */
publicRoutes.get("/bookings/:ref", async (c) => {
  await rateLimit(c, "RL_READ", "status");
  const ref = c.req.param("ref");
  if (!/^TS-[A-Z0-9]{8}$/.test(ref)) fail(404, "Booking not found");
  const row = await c.env.DB.prepare(
    `SELECT b.status, b.start_at, b.hold_expires_at, b.service_snapshot, b.session_format, p.status AS payment
     FROM bookings b LEFT JOIN payments p ON p.booking_id = b.id WHERE b.id = ?1`,
  )
    .bind(ref)
    .first<{
      status: string;
      start_at: number;
      hold_expires_at: number | null;
      service_snapshot: string;
      session_format: string;
      payment: string | null;
    }>();
  if (!row) fail(404, "Booking not found");
  let status = row.status;
  if (status === "held" && (row.hold_expires_at ?? 0) <= Date.now()) status = "expired";
  if (status === "held" && row.payment === "failed") status = "failed";
  if (status === "completed") status = "confirmed";
  const snap = JSON.parse(row.service_snapshot) as { name: string };
  return c.json({
    reference: ref,
    status,
    service: snap.name,
    format: row.session_format,
    startAt: row.start_at,
  });
});
