import type { AppEnv } from "../env";

/** Escapes a client value for an HTML email. */
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Removes line breaks so a value can't add email headers. */
export function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

type Mail = { kind: string; to: string; subject: string; html: string; replyTo?: string; ref?: string };

/**
 * Sends one email through Resend's HTTP API and records the outcome in email_log.
 * Without RESEND_API_KEY or EMAIL_FROM it records "skipped" and sends nothing.
 * Never throws: email problems must not fail the request that triggered them.
 */
export async function sendMail(env: AppEnv, mail: Mail) {
  const now = Date.now();
  const log = (status: "sent" | "failed" | "skipped", error?: string) =>
    env.DB.prepare(
      "INSERT INTO email_log (kind, recipient, ref, status, last_error, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
      .bind(mail.kind, mail.to, mail.ref ?? null, status, error ?? null, now)
      .run();

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await log("skipped", "Resend is not configured");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [mail.to],
        subject: oneLine(mail.subject),
        html: mail.html,
        reply_to: mail.replyTo ? [mail.replyTo] : undefined,
      }),
    });
    // Log the status only: the response may echo addresses.
    await log(res.ok ? "sent" : "failed", res.ok ? undefined : `HTTP ${res.status}`);
  } catch {
    await log("failed", "Network error");
  }
}

/** Simple white-and-gold layout shared by every email. */
export function layout(title: string, rows: ReadonlyArray<[string, string]>, intro = "") {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5a5145;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;color:#1e1a14;white-space:pre-line">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#fdf9f0;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0;color:#8f6514;font-size:12px;letter-spacing:3px;font-weight:bold">TAROT BY SATAKSHI</p>
<h1 style="margin:12px 0 8px;font-family:Georgia,serif;font-weight:normal;color:#1e1a14">${escapeHtml(title)}</h1>
${intro ? `<p style="color:#5a5145">${escapeHtml(intro)}</p>` : ""}
<table style="margin-top:16px;border-collapse:collapse;font-size:15px">${body}</table>
</div></body></html>`;
}
