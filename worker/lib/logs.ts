import type { AppEnv } from "../env";

// Writes to the LOGS database. Logging must never break the request that caused
// it, so every function here swallows its own errors.

export async function audit(env: AppEnv, actor: string, action: string, target = "", detail = "") {
  try {
    await env.LOGS.prepare(
      "INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
      .bind(Date.now(), actor, action, target.slice(0, 120), detail.slice(0, 500))
      .run();
  } catch {
    console.error("audit log write failed");
  }
}

/** Records a gateway event id. Returns false if it was already recorded (a repeat). */
export async function recordPaymentEvent(
  env: AppEnv,
  e: { id: string; event: string; orderId?: string; paymentId?: string; outcome: string },
) {
  try {
    const res = await env.LOGS.prepare(
      `INSERT INTO payment_events (event_id, at, event, order_id, payment_id, outcome)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (event_id) DO NOTHING`,
    )
      .bind(e.id, Date.now(), e.event, e.orderId ?? null, e.paymentId ?? null, e.outcome)
      .run();
    return res.meta.changes > 0;
  } catch {
    return true;
  }
}

export async function logEmail(
  env: AppEnv,
  kind: string,
  to: string,
  ref: string | null,
  status: string,
  error?: string,
) {
  try {
    await env.LOGS.prepare(
      "INSERT INTO email_log (kind, recipient, ref, status, last_error, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
      .bind(kind, to, ref, status, error ?? null, Date.now())
      .run();
  } catch {
    console.error("email log write failed");
  }
}
