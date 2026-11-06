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
  /** Plain-text copy. Made from the HTML when not given (mail apps and spam filters expect one). */
  text?: string;
  replyTo?: string;
  ref?: string;
  attachments?: { filename: string; content: string }[];
};

/** Local tests only: RESEND_API_BASE on 127.0.0.1 points at a mock. Anything else is ignored. */
function resendBase(env: AppEnv) {
  const local = (env as AppEnv & { RESEND_API_BASE?: string }).RESEND_API_BASE;
  return local && /^http:\/\/127\.0\.0\.1:\d+$/.test(local) ? local : "https://api.resend.com";
}

/** Sends one email and records the outcome in LOGS.email_log. Never throws; returns true if sent. */
export async function sendMail(env: AppEnv, mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await logEmail(env, mail.kind, mail.to, mail.ref ?? null, "skipped", "Resend is not configured");
    return false;
  }
  try {
    const res = await fetch(`${resendBase(env)}/emails`, {
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
        text: mail.text ?? htmlToText(mail.html),
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
    return res.ok;
  } catch {
    await logEmail(env, mail.kind, mail.to, mail.ref ?? null, "failed", "Network error");
    return false;
  }
}

/** Plain-text copy of one of our HTML emails (they only use p, h1, table rows and links). */
export function htmlToText(html: string) {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, href: string, label: string) =>
      label && label !== href ? `${label} (${href})` : href,
    )
    .replace(/<\/td><td[^>]*>/g, ": ")
    .replace(/<(br|\/p|\/h1|\/tr|\/div)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type EmailLink = { label: string; href: string };

/**
 * White-and-gold layout shared by every email. Every value is escaped.
 * `links` (optional) are shown under the details, for example the booking status page.
 */
export function layout(
  title: string,
  rows: ReadonlyArray<[string, string]>,
  intro = "",
  links: ReadonlyArray<EmailLink> = [],
) {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5a5145;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;color:#1e1a14;white-space:pre-line">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const linkList = links
    .filter((l) => l.href.startsWith("https://"))
    .map(
      (l) =>
        `<p style="margin:8px 0"><a href="${escapeHtml(l.href)}" style="color:#73500e;font-weight:bold">${escapeHtml(l.label)}</a></p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#fdf9f0;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0;color:#8f6514;font-size:12px;letter-spacing:3px;font-weight:bold">TAROT BY SATAKSHI</p>
<h1 style="margin:12px 0 8px;font-family:Georgia,serif;font-weight:normal;color:#1e1a14">${escapeHtml(title)}</h1>
${intro ? `<p style="color:#5a5145;line-height:1.6">${escapeHtml(intro)}</p>` : ""}
<table style="margin-top:16px;border-collapse:collapse;font-size:15px">${body}</table>
${linkList ? `<div style="margin-top:24px">${linkList}</div>` : ""}
</div></body></html>`;
}

/** The public site address for links in emails, e.g. https://guidancebysatakshi.com. */
function siteUrl(env: AppEnv) {
  const url = env.SITE_URL ?? "";
  return /^https:\/\/[a-z0-9.-]+$/.test(url) ? url : "";
}

type BookingEmailRow = {
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
};

function loadBooking(env: AppEnv, bookingId: string) {
  return env.DB.prepare(
    `SELECT id, service_snapshot, session_format, start_at, end_at, client_name, client_email, client_phone,
            topic, question, answers_json, amount_paise FROM bookings WHERE id = ?1`,
  )
    .bind(bookingId)
    .first<BookingEmailRow>();
}

function rupeeLabel(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
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

function bookingFacts(b: BookingEmailRow) {
  const service = JSON.parse(b.service_snapshot) as { name: string; durationMin: number };
  return {
    service,
    when: `${istLabel(b.start_at)} IST`,
    format: b.session_format === "call" ? "Call session" : "Text session",
  };
}

/**
 * After a confirmed payment: a confirmation (with a calendar file) to the client,
 * and a "New booking" email with every answer to the admin (NOTIFY_EMAIL).
 * Each email is sent once per booking (Resend idempotency key kind:ref:to).
 */
export async function sendBookingEmails(env: AppEnv, bookingId: string) {
  const b = await loadBooking(env, bookingId);
  if (!b) return;
  const { service, when, format } = bookingFacts(b);
  const amount = rupeeLabel(b.amount_paise);
  const site = siteUrl(env);

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
      `Thank you, ${b.client_name}. Satakshi will reach out to you on ${b.client_phone} for your ${format.toLowerCase()} at the time above. The calendar file attached adds it to your calendar. Questions? Reply to this email.`,
      site
        ? [
            { label: "Check your booking", href: `${site}/book/status?ref=${encodeURIComponent(b.id)}` },
            { label: "Refund and cancellation policy", href: `${site}/refund-policy` },
          ]
        : [],
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
    html: layout(
      "New booking",
      [
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
      ],
      "Reply to this email to write to the client.",
      site ? [{ label: "Open the admin", href: `${site}/admin` }] : [],
    ),
  });
}

/**
 * After a refund: the client is told how much and when to expect it, and the admin
 * gets a copy. `why` is "slot_taken" (automatic) or "admin" (Refund in the admin).
 */
export async function sendRefundEmails(
  env: AppEnv,
  bookingId: string,
  refundedPaise: number,
  why: "slot_taken" | "admin",
) {
  const b = await loadBooking(env, bookingId);
  if (!b) return;
  const { service, when } = bookingFacts(b);
  const amount = rupeeLabel(refundedPaise);
  const site = siteUrl(env);
  const reason =
    why === "slot_taken"
      ? "Your payment went through after the time you chose had already been booked by someone else, so your booking couldn't be confirmed."
      : "Your booking has been refunded.";

  await sendMail(env, {
    kind: `refund.client.${why}`,
    to: b.client_email,
    ref: b.id,
    replyTo: env.NOTIFY_EMAIL,
    subject: `Refund of ${amount} for ${service.name}`,
    html: layout(
      "Your refund is on its way",
      [
        ["Reading", service.name],
        ["Time booked", when],
        ["Refunded", amount],
        ["Reference", b.id],
      ],
      `Hello ${b.client_name}. ${reason} The money goes back to the card, UPI or bank account you paid from. Razorpay usually processes it within 5 to 7 working days; your bank may take longer to show it. Questions? Reply to this email.`,
      site ? [{ label: "Refund and cancellation policy", href: `${site}/refund-policy` }] : [],
    ),
  });

  await sendMail(env, {
    kind: `refund.owner.${why}`,
    to: env.NOTIFY_EMAIL,
    ref: b.id,
    replyTo: b.client_email,
    subject: `Refunded ${amount}: ${service.name}, ${when}`,
    html: layout(
      why === "slot_taken" ? "Automatic refund: time already taken" : "Refund sent",
      [
        ["Reading", service.name],
        ["Time booked", when],
        ["Refunded", amount],
        ["Name", b.client_name],
        ["Email", b.client_email],
        ["Reference", b.id],
      ],
      "The client has been emailed.",
    ),
  });
}

/** When the admin cancels a paid booking, the client is told. Money is handled by Refund. */
export async function sendCancelEmail(env: AppEnv, bookingId: string) {
  const b = await loadBooking(env, bookingId);
  if (!b) return;
  const paid = await env.DB.prepare(
    "SELECT 1 FROM payments WHERE booking_id = ?1 AND status IN ('paid', 'refund_pending', 'refunded')",
  )
    .bind(bookingId)
    .first();
  if (!paid) return; // an unpaid hold: the client was never charged or confirmed
  const { service, when } = bookingFacts(b);
  const site = siteUrl(env);
  await sendMail(env, {
    kind: "booking.cancelled",
    to: b.client_email,
    ref: b.id,
    replyTo: env.NOTIFY_EMAIL,
    subject: `Your session has been cancelled: ${service.name}`,
    html: layout(
      "Your session has been cancelled",
      [
        ["Reading", service.name],
        ["Time", when],
        ["Reference", b.id],
      ],
      `Hello ${b.client_name}. Your session above has been cancelled. Please reply to this email if you have any questions.`,
      site ? [{ label: "Refund and cancellation policy", href: `${site}/refund-policy` }] : [],
    ),
  });
}
