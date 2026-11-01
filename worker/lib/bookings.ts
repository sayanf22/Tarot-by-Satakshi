import type { AppEnv } from "../env";
import { UNIT_MS, unitsFor } from "./data";
import { sendBookingEmails } from "./email";
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

export type SettleResult = "confirmed" | "already" | "refunded" | "ignored";

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

/**
 * Turns a verified, captured Razorpay payment into a confirmed booking.
 * - The payment must match our order id, amount and currency (checked by the caller via paymentMatches).
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
  if (!paymentMatches(p, payment.gateway_order_id, payment.amount_paise)) return "ignored";

  let paid = p;
  if (paid.status === "authorized") paid = await capturePayment(env, p.id, payment.amount_paise);
  if (paid.status !== "captured") return "ignored";

  if (["confirmed", "completed"].includes(booking.status)) return "already";
  if (booking.status === "refunded" || payment.status === "refunded" || payment.status === "refund_pending")
    return "refunded";

  const now = Date.now();
  const db = env.DB;
  const expected = Math.round((booking.end_at - booking.start_at) / UNIT_MS);
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

  // 1. The hold still owns its time blocks: confirm.
  const [, confirmed] = await db.batch([markPaid, confirm]);
  let ok = (confirmed?.meta.changes ?? 0) > 0;

  // 2. The hold lapsed and its blocks were released: claim them again if free.
  if (!ok) {
    try {
      await db.batch([
        db
          .prepare(
            `DELETE FROM booking_slot_units WHERE unit_start IN (SELECT value FROM json_each(?1))
             AND booking_id IN (SELECT id FROM bookings WHERE status IN ('held', 'expired') AND hold_expires_at <= ?2 AND id != ?3)`,
          )
          .bind(JSON.stringify(unitsFor(booking.start_at, expected * 15)), now, booking.id),
        db.prepare("DELETE FROM booking_slot_units WHERE booking_id = ?1").bind(booking.id),
        ...unitsFor(booking.start_at, expected * 15).map((u) =>
          db
            .prepare("INSERT INTO booking_slot_units (unit_start, booking_id) VALUES (?1, ?2)")
            .bind(u, booking.id),
        ),
        confirm,
      ]);
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (ok) {
    await audit(env, actor, "booking.confirmed", booking.id, `payment ${paid.id}`);
    ctx.waitUntil(sendBookingEmails(env, booking.id));
    return "confirmed";
  }

  // 3. The time was taken by another client: refund in full.
  await db
    .prepare("UPDATE payments SET status = 'refund_pending', updated_at = ?1 WHERE gateway_order_id = ?2")
    .bind(now, payment.gateway_order_id)
    .run();
  try {
    const refund = await refundPayment(env, paid.id, payment.amount_paise, "Time slot no longer available");
    await db.batch([
      db
        .prepare(
          "UPDATE payments SET status = 'refunded', refund_id = ?1, refunded_paise = ?2, updated_at = ?3 WHERE gateway_order_id = ?4",
        )
        .bind(refund.id, refund.amount, now, payment.gateway_order_id),
      db
        .prepare("UPDATE bookings SET status = 'refunded', updated_at = ?1 WHERE id = ?2")
        .bind(now, booking.id),
    ]);
  } catch (err) {
    console.error("auto refund failed", err instanceof Error ? err.message : "");
  }
  await audit(env, actor, "booking.slot_taken_refunded", booking.id, `payment ${paid.id}`);
  return "refunded";
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
