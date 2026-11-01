import type { AppEnv } from "../env";
import { logEmail } from "./logs";

// Emails go through Resend's HTTP API (no SDK, so very little CPU). Until
// RESEND_API_KEY and EMAIL_FROM are set, every email is logged as "skipped" and
// nothing is sent; bookings and messages still work and show in the admin.

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

type Mail = {
  kind: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  ref?: string;
  attachments?: { filename: string; content: string }[];
};

/** Sends one email and records the outcome in LOGS.email_log. Never throws. */
export async function sendMail(env: AppEnv, mail: Mail) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await logEmail(env, mail.kind, mail.to, mail.ref ?? null, "skipped", "Resend is not configured");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Resend skips a repeat with the same key, so a retried request can't email twice.
        "Idempotency-Key": `${mail.kind}:${mail.ref ?? crypto.randomUUID()}:${mail.to}`.slice(0, 256),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [mail.to],
        subject: oneLine(mail.subject),
        html: mail.html,
        reply_to: mail.replyTo ? [mail.replyTo] : undefined,
        attachments: mail.attachments,
      }),
      signal: AbortSignal.timeout(8000),
    });
    await logEmail(
      env,
      mail.kind,
      mail.to,
      mail.ref ?? null,
      res.ok ? "sent" : "failed",
      res.ok ? undefined : `HTTP ${res.status}`,
    );
  } catch {
    await logEmail(env, mail.kind, mail.to, mail.ref ?? null, "failed", "Network error");
  }
}

/** White-and-gold layout shared by every email. Every value is escaped. */
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
${intro ? `<p style="color:#5a5145;line-height:1.6">${escapeHtml(intro)}</p>` : ""}
<table style="margin-top:16px;border-collapse:collapse;font-size:15px">${body}</table>
</div></body></html>`;
}

function istLabel(ms: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

function icsDate(ms: number) {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** A calendar file for the session, so the client can add it in one tap. */
function ics(ref: string, name: string, start: number, end: number) {
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tarot by Satakshi//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ref}@tarotbysatakshi`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${oneLine(name).replace(/[,;\\]/g, " ")} with Satakshi`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return btoa(text);
}

/** Confirmation to the client and a "New booking" email to Satakshi. */
export async function sendBookingEmails(env: AppEnv, bookingId: string) {
  const b = await env.DB.prepare(
    `SELECT id, service_snapshot, session_format, start_at, end_at, client_name, client_email, client_phone,
            topic, question, answers_json, amount_paise FROM bookings WHERE id = ?1`,
  )
    .bind(bookingId)
    .first<{
      id: string;
      service_snapshot: string;
      session_format: string;
      start_at: number;
      end_at: number;
      client_name: string;
      client_email: string;
      client_phone: string;
      topic: string;
      question: string;
      answers_json: string;
      amount_paise: number;
    }>();
  if (!b) return;
  const service = JSON.parse(b.service_snapshot) as { name: string; durationMin: number };
  const when = `${istLabel(b.start_at)} IST`;
  const amount = `₹${(b.amount_paise / 100).toLocaleString("en-IN")}`;
  const format = b.session_format === "call" ? "Call session" : "Text session";

  await sendMail(env, {
    kind: "booking.client",
    to: b.client_email,
    ref: b.id,
    replyTo: env.NOTIFY_EMAIL,
    subject: `Your reading is booked: ${service.name}`,
    html: layout(
      "Your booking is confirmed",
      [
        ["Reading", service.name],
        ["Session", format],
        ["When", when],
        ["Length", `${service.durationMin} minutes`],
        ["Paid", amount],
        ["Reference", b.id],
      ],
      `Thank you, ${b.client_name}. Satakshi will reach out to you for your session. Bookings are non-refundable. To change anything, reply to this email.`,
    ),
    attachments: [{ filename: "session.ics", content: ics(b.id, service.name, b.start_at, b.end_at) }],
  });

  const answers = JSON.parse(b.answers_json) as Record<string, string | null>;
  await sendMail(env, {
    kind: "booking.owner",
    to: env.NOTIFY_EMAIL,
    ref: b.id,
    replyTo: b.client_email,
    subject: `New booking: ${service.name}, ${when}`,
    html: layout("New booking", [
      ["Reading", service.name],
      ["Session", format],
      ["When", when],
      ["Paid", amount],
      ["Name", b.client_name],
      ["Email", b.client_email],
      ["WhatsApp", b.client_phone],
      ["Topic", b.topic],
      ["Question", b.question || "Not given"],
      ...Object.entries(answers).map(([k, v]) => [k, v ?? "Not given"] as [string, string]),
      ["Reference", b.id],
    ]),
  });
}
