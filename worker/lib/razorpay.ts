import type { AppEnv } from "../env";
import { hmacSha256Hex, safeEqual } from "./crypto";

// Razorpay Standard Checkout, server side. The key secret never leaves the Worker.
// Docs: razorpay.com/docs/payments/payment-gateway/web-integration/standard/
// Order → Checkout → verify signature (order_id|payment_id) → confirm with the
// Payments API → webhook (payment.captured / order.paid) as the backstop.

const API = "https://api.razorpay.com/v1";

/**
 * Local tests only: RAZORPAY_API_BASE in .dev.vars can point to a mock Razorpay on
 * 127.0.0.1. Anything else is ignored, and a deployed Worker can't reach 127.0.0.1,
 * so this can never redirect real payments.
 */
function apiBase(env: AppEnv) {
  const local = (env as AppEnv & { RAZORPAY_API_BASE?: string }).RAZORPAY_API_BASE;
  return local && /^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(local) ? local : API;
}

export function paymentsConfigured(env: AppEnv) {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
}

async function call<T>(env: AppEnv, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase(env)}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    // Log the code only: Razorpay errors can echo customer details.
    const err = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    throw new Error(
      `Razorpay ${method} ${path.split("/")[1]} failed: HTTP ${res.status} ${err.error?.code ?? ""}`,
    );
  }
  return (await res.json()) as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RzpPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured?: boolean;
};

export function createOrder(
  env: AppEnv,
  amountPaise: number,
  receipt: string,
  notes: Record<string, string>,
) {
  return call<RzpOrder>(env, "POST", "/orders", { amount: amountPaise, currency: "INR", receipt, notes });
}

export function fetchPayment(env: AppEnv, paymentId: string) {
  return call<RzpPayment>(env, "GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export function orderPayments(env: AppEnv, orderId: string) {
  return call<{ items: RzpPayment[] }>(env, "GET", `/orders/${encodeURIComponent(orderId)}/payments`);
}

/** Captures an authorized payment (only needed if auto-capture is off in the dashboard). */
export function capturePayment(env: AppEnv, paymentId: string, amountPaise: number) {
  return call<RzpPayment>(env, "POST", `/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountPaise,
    currency: "INR",
  });
}

export function refundPayment(env: AppEnv, paymentId: string, amountPaise: number, note: string) {
  return call<{ id: string; status: string; amount: number }>(
    env,
    "POST",
    `/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      amount: amountPaise,
      speed: "normal",
      notes: { reason: note.slice(0, 200) },
    },
  );
}

/** Checkout handler signature: HMAC-SHA256(order_id + "|" + payment_id, key secret). */
export async function checkoutSignatureValid(
  env: AppEnv,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return safeEqual(await hmacSha256Hex(env.RAZORPAY_KEY_SECRET!, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export async function webhookSignatureValid(env: AppEnv, rawBody: string, signature: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return safeEqual(await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET!, rawBody), signature);
}

/** A payment counts only when captured for exactly the order and amount we expect. */
export function paymentMatches(p: RzpPayment, orderId: string, amountPaise: number) {
  return p.order_id === orderId && p.amount === amountPaise && p.currency === "INR";
}
