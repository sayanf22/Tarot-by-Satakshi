import type { AppEnv } from "../env";
import { unitsFor } from "./data";
import { sendBookingEmails, sendRefundEmails } from "./email";
import { audit } from "./logs";
import {
  capturePayment,
  fetchPayment,
  orderPayments,
  paymentMatches,
  refundPayment,
  type RzpPayment,
} from "./razorpay";
import { MINUTE } from "./time";

// Booking life cycle, shared by the checkout callback, the webhook and the cron.
// Every step is idempotent: running it twice for the same payment changes nothing.

type BookingRow = {
  id: string;
  status: string;
  start_at: number;
  end_at: number;
  hold_expires_at: number | null;
  amount_paise: number;
};
type PaymentRow = {
  booking_id: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  amount_paise: number;
  status: string;
};

/** Only waitUntil is needed, from a request or from the cron. */
type WaitCtx = { waitUntil(promise: Promise<unknown>): void };

export type SettleResult = "confirmed" | "already" | "refunded" | "duplicate" | "ignored";

async function bookingStatus(env: AppEnv, id: string) {
  return (
    await env.DB.prepare("SELECT status FROM bookings WHERE id = ?1").bind(id).first<{ status: string }>()
  )?.status;
}

/**
 * Refunds a captured payment in full. Safe to call more than once for the same payment:
 * Razorpay's idempotency key returns the first refund, and a payment already refunded is skipped.
 */
async function refundInFull(env: AppEnv, p: RzpPayment, note: string) {
  if ((p.amount_refunded ?? 0) >= p.amount || p.status === "refunded") return null;
  return refundPayment(env, p.id, p.amount, note, `refund_${p.id}`);
}

/**
 * Turns a verified Razorpay payment into a confirmed booking. Called by the checkout callback,
 * the webhook and the cron, in any order and any number of times, possibly at the same moment.
 * - The payment must match our order id, amount and currency.
 * - A second payment for a booking that is already paid (Razorpay allows only one per order, but
 *   a late-authorised attempt can still arrive) is never captured, and is refunded if captured.
 * - A payment that arrives after the session time has passed is never captured; if Razorpay
 *   already captured it, it is refunded in full.
 * - If the hold lapsed but the time is still free, the time is claimed again.
 * - If someone else booked the time meanwhile, the money is refunded in full automatically.
 */
export async function settlePayment(
  env: AppEnv,
  ctx: WaitCtx,
  p: RzpPayment,
  actor: string,
): Promise<SettleResult> {
  const found = await loadByOrder(env, p.order_id);
  if (!found) return "ignored";
  const { payment, booking } = found;
  if (!paymentMatches(p, payment.gateway_order_id, payment.amount_paise)) {
    await audit(env, actor, "payment.mismatch", booking.id, `payment ${p.id}`);
    return "ignored";
  }
  if (p.status !== "authorized" && p.status !== "captured") return "ignored";

  const now = Date.now();
  const isOurPayment = !payment.gateway_payment_id || payment.gateway_payment_id === p.id;
  const settled =
    ["confirmed", "completed", "refunded"].includes(booking.status) ||
    payment.status === "refunded" ||
    payment.status === "refund_pending";

  // 1. The booking is already settled by an earlier payment: this one is extra.
  if (settled && !isOurPayment) {
    if (p.status === "captured") {
      try {
        const refund = await refundInFull(env, p, "Extra payment for a booking that was already paid");
        if (refund)
          ctx.waitUntil(
            sendRefundEmails(env, booking.id, refund.amount, "duplicate", `${booking.id}-${p.id}`),
          );
      } catch (err) {
        console.error("extra payment refund failed", err instanceof Error ? err.message : "");
        throw err; // 500 → Razorpay retries the webhook; the cron also tries again
      }
    }
    // An authorised extra payment is left alone: Razorpay refunds it automatically.
    await audit(env, actor, "payment.extra", booking.id, `payment ${p.id} (${p.status})`);
    return "duplicate";
  }
  if (["confirmed", "completed"].includes(booking.status)) return "already";
  if (booking.status === "refunded" || payment.status === "refunded" || payment.status === "refund_pending")
    return "refunded";

  // 2. Paid after the session should have started (a late authorisation can take up to 3 days).
  if (booking.start_at <= now) {
    if (p.status === "captured") {
      const refund = await refundInFull(env, p, "Payment arrived after the session time");
      await db_markRefunded(env, payment.gateway_order_id, booking.id, p.id, refund, now);
      if (refund) ctx.waitUntil(sendRefundEmails(env, booking.id, refund.amount, "too_late"));
    }
    await audit(env, actor, "payment.too_late", booking.id, `payment ${p.id} (${p.status})`);
    return "refunded";
  }

  let paid = p;
  if (paid.status === "authorized") paid = await capturePayment(env, p.id, payment.amount_paise);
  if (paid.status !== "captured") return "ignored";

  const db = env.DB;
  // The same blocks the booking claimed when it was made (see unitsFor).
  const blocks = unitsFor(booking.start_at, Math.round((booking.end_at - booking.start_at) / MINUTE));
  const expected = blocks.length;
  const markPaid = db
    .prepare(
      `UPDATE payments SET status = 'paid', gateway_payment_id = ?1, method = ?2, updated_at = ?3
       WHERE gateway_order_id = ?4 AND status IN ('created', 'failed')`,
    )
    .bind(paid.id, paid.method ?? null, now, payment.gateway_order_id);
  const confirm = db
    .prepare(
      `UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL, confirmed_at = ?1, updated_at = ?1
       WHERE id = ?2 AND status IN ('held', 'expired')
         AND (SELECT count(*) FROM booking_slot_units WHERE booking_id = ?2) = ?3`,
    )
    .bind(now, booking.id, expected);

  // 3. The hold still owns its time blocks: confirm. Only one caller can change the row.
  const [, confirmed] = await db.batch([markPaid, confirm]);
  let ok = (confirmed?.meta.changes ?? 0) > 0;
  // Another caller (webhook, checkout callback or cron) confirmed it a moment ago.
  if (!ok && ["confirmed", "completed"].includes((await bookingStatus(env, booking.id)) ?? ""))
    return "already";

  // 4. The hold lapsed and its blocks were released: claim them again if free.
  if (!ok) {
    try {
      const results = await db.batch([
        db
          .prepare(
            `DELETE FROM booking_slot_units WHERE unit_start IN (SELECT value FROM json_each(?1))
             AND booking_id IN (SELECT id FROM bookings WHERE status IN ('held', 'expired') AND hold_expires_at <= ?2 AND id != ?3)`,
          )
          .bind(JSON.stringify(blocks), now, booking.id),
        db.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(booking.id),
        ...blocks.map((u) =>
          db
            .prepare("INSERT INTO booking_slot_units (unit_start, booking_id) VALUES (?1, ?2)")
            .bind(u, booking.id),
        ),
        confirm,
      ]);
      ok = (results.at(-1)?.meta.changes ?? 0) > 0;
    } catch {
      ok = false;
    }
    if (!ok && ["confirmed", "completed"].includes((await bookingStatus(env, booking.id)) ?? ""))
      return "already";
  }

  if (ok) {
    await audit(env, actor, "booking.confirmed", booking.id, `payment ${paid.id}`);
    ctx.waitUntil(sendBookingEmails(env, booking.id));
    return "confirmed";
  }

  // 5. The time was taken by another client: refund in full.
  const lock = await db
    .prepare(
      "UPDATE payments SET status = 'refund_pending', updated_at = ?1 WHERE gateway_order_id = ?2 AND status IN ('created', 'failed', 'paid')",
    )
    .bind(now, payment.gateway_order_id)
    .run();
  // Someone else is already refunding it.
  if (!lock.meta.changes) return "refunded";
  try {
    const refund = await refundInFull(env, paid, "Time slot no longer available");
    await db_markRefunded(env, payment.gateway_order_id, booking.id, paid.id, refund, now);
    if (refund) ctx.waitUntil(sendRefundEmails(env, booking.id, refund.amount, "slot_taken"));
  } catch (err) {
    // Left as refund_pending: the admin sees it, and the cron retries it (same idempotency key).
    console.error("auto refund failed", err instanceof Error ? err.message : "");
  }
  await audit(env, actor, "booking.slot_taken_refunded", booking.id, `payment ${paid.id}`);
  return "refunded";
}

/** Records a full refund on the payment and the booking. */
async function db_markRefunded(
  env: AppEnv,
  orderId: string,
  bookingId: string,
  paymentId: string,
  refund: { id: string; amount: number } | null,
  now: number,
) {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE payments SET status = 'refunded', gateway_payment_id = COALESCE(gateway_payment_id, ?1),
         refund_id = COALESCE(?2, refund_id), refunded_paise = COALESCE(?3, refunded_paise), updated_at = ?4
       WHERE gateway_order_id = ?5`,
    ).bind(paymentId, refund?.id ?? null, refund?.amount ?? null, now, orderId),
    env.DB.prepare(
      "UPDATE bookings SET status = 'refunded', hold_expires_at = NULL, updated_at = ?1 WHERE id = ?2 AND status IN ('held', 'expired')",
    ).bind(now, bookingId),
    env.DB.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(bookingId),
  ]);
}

async function loadByOrder(env: AppEnv, orderId: string) {
  const payment = await env.DB.prepare(
    "SELECT booking_id, gateway_order_id, gateway_payment_id, amount_paise, status FROM payments WHERE gateway_order_id = ?1",
  )
    .bind(orderId)
    .first<PaymentRow>();
  if (!payment) return null;
  const booking = await env.DB.prepare(
    "SELECT id, status, start_at, end_at, hold_expires_at, amount_paise FROM bookings WHERE id = ?1",
  )
    .bind(payment.booking_id)
    .first<BookingRow>();
  return booking ? { payment, booking } : null;
}

/** Verifies a payment id with Razorpay (never trusting the browser) and settles it. */
export async function settleByPaymentId(env: AppEnv, ctx: WaitCtx, paymentId: string, actor: string) {
  const p = await fetchPayment(env, paymentId);
  return settlePayment(env, ctx, p, actor);
}

/**
 * Cron: release holds that lapsed more than 5 minutes ago (the grace covers a
 * payment that is still finishing), then check recent unpaid orders with Razorpay
 * in case a webhook was missed. Then prune old data.
 */
export async function maintenance(env: AppEnv, ctx: WaitCtx) {
  const now = Date.now();
  const db = env.DB;
  await db.batch([
    db
      .prepare(
        `DELETE FROM booking_slot_units WHERE booking_id IN
           (SELECT id FROM bookings WHERE status = 'held' AND hold_expires_at < ?1)`,
      )
      .bind(now - 5 * MINUTE),
    db
      .prepare(
        "UPDATE bookings SET status = 'expired', updated_at = ?2 WHERE status = 'held' AND hold_expires_at < ?1",
      )
      .bind(now - 5 * MINUTE, now),
    db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?1").bind(now),
  ]);

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    // Orders created in the last 3 hours that are still unpaid. At most 10 per run,
    // well within the free plan's 50 outside requests per invocation.
    const { results } = await db
      .prepare(
        `SELECT gateway_order_id FROM payments WHERE status IN ('created', 'failed') AND created_at > ?1
         ORDER BY created_at DESC LIMIT 10`,
      )
      .bind(now - 3 * 60 * MINUTE)
      .all<{ gateway_order_id: string }>();
    for (const r of results) {
      try {
        const { items } = await orderPayments(env, r.gateway_order_id);
        const good = items.find((p) => p.status === "captured" || p.status === "authorized");
        if (good) await settlePayment(env, ctx, good, "cron");
      } catch (err) {
        console.error("reconcile failed", err instanceof Error ? err.message : "");
      }
    }

    // Automatic refunds that Razorpay didn't accept (network error, timeout): try again.
    // The idempotency key is the same as the first try, so this can never refund twice.
    // Only automatic refunds (the booking never confirmed); admin refunds reset on failure.
    const { results: stuck } = await db
      .prepare(
        `SELECT p.gateway_order_id, p.gateway_payment_id, p.booking_id FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         WHERE p.status = 'refund_pending' AND p.gateway_payment_id IS NOT NULL
           AND b.status IN ('held', 'expired') AND p.updated_at < ?1
         ORDER BY p.updated_at LIMIT 5`,
      )
      .bind(now - 2 * MINUTE)
      .all<{ gateway_order_id: string; gateway_payment_id: string; booking_id: string }>();
    for (const r of stuck) {
      try {
        const p = await fetchPayment(env, r.gateway_payment_id);
        const refund = await refundInFull(env, p, "Time slot no longer available");
        await db_markRefunded(env, r.gateway_order_id, r.booking_id, p.id, refund, Date.now());
        if (refund) ctx.waitUntil(sendRefundEmails(env, r.booking_id, refund.amount, "slot_taken"));
        await audit(env, "cron", "refund.retried", r.booking_id, `payment ${p.id}`);
      } catch (err) {
        console.error("refund retry failed", err instanceof Error ? err.message : "");
      }
    }
  }

  // Pruning runs once an hour (the first run after the hour), not every 10 minutes,
  // to keep database reads low. Nothing here is needed after these periods:
  // unpaid holds after 2 days, used or expired sign-in codes and sign-in attempts
  // after 1 day, email records after 90 days. Payment events and the admin activity
  // log are kept for a year (payment disputes can come months later).
  if (new Date(now).getUTCMinutes() >= 10) return;
  const day = 24 * 60 * MINUTE;
  await db.batch([
    db
      .prepare(
        "DELETE FROM payments WHERE status IN ('created', 'failed') AND booking_id IN (SELECT id FROM bookings WHERE status = 'expired' AND created_at < ?1)",
      )
      .bind(now - 2 * day),
    db
      .prepare(
        "DELETE FROM bookings WHERE status = 'expired' AND created_at < ?1 AND id NOT IN (SELECT booking_id FROM payments)",
      )
      .bind(now - 2 * day),
    db.prepare("DELETE FROM admin_login_codes WHERE created_at < ?1").bind(now - day),
  ]);
  const yearAgo = now - 365 * day;
  await env.LOGS.batch([
    env.LOGS.prepare("DELETE FROM login_attempts WHERE at < ?1").bind(now - day),
    env.LOGS.prepare("DELETE FROM email_log WHERE created_at < ?1").bind(now - 90 * day),
    env.LOGS.prepare("DELETE FROM payment_events WHERE at < ?1").bind(yearAgo),
    env.LOGS.prepare("DELETE FROM audit_log WHERE at < ?1").bind(yearAgo),
  ]);
}
