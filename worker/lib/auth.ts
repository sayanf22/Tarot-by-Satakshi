import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../env";
import { hmacSha256Hex, randomToken, safeEqual, sha256Hex } from "./crypto";
import { escapeHtml, sendMail } from "./email";
import { clientIp, fail, requireSameOrigin } from "./http";

// Admin sign-in by emailed one-time code (Resend). No passwords.
// 1. The admin enters her email. If it's on ADMIN_EMAILS, a random 6-digit code is
//    emailed. The reply is the same either way, so nobody can test which emails work.
// 2. She enters the code. It expires after 10 minutes, works once, and allows 5 tries;
//    a new code cancels the old one. Only an HMAC of the code is stored.
// 3. A session is a random token in a __Host- cookie (HttpOnly, Secure,
//    SameSite=Strict); only its SHA-256 is stored, so a database leak gives no session.
// Limits: 5 requests a minute per IP (rate-limit binding), 5 codes an hour per email,
// and 10 wrong codes in 15 minutes from one IP (30 from anywhere) locks sign-in.

export const SESSION_COOKIE = "__Host-tbs_admin";
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const CODE_MS = 10 * 60 * 1000;
const CODE_TRIES = 5;
const CODES_PER_HOUR = 5;
const WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURES = 10;
const GLOBAL_FAILURES = 30;

export function adminEmails(c: Context<AppContext>) {
  return c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function adminConfigured(c: Context<AppContext>) {
  return Boolean(c.env.RESEND_API_KEY && c.env.EMAIL_FROM && c.env.RATE_LIMIT_SALT && adminEmails(c).length);
}

async function ipHash(c: Context<AppContext>) {
  return (await sha256Hex(`${c.env.RATE_LIMIT_SALT}:${clientIp(c)}`)).slice(0, 32);
}

function codeHash(c: Context<AppContext>, id: string, code: string) {
  return hmacSha256Hex(c.env.RATE_LIMIT_SALT!, `login-code:${id}:${code}`);
}

/** Uniformly random 6-digit code (rejection sampling, no modulo bias). */
function sixDigits() {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0]!;
    if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, "0");
  }
}

async function lockedOut(c: Context<AppContext>, ip: string) {
  const since = Date.now() - WINDOW_MS;
  const [mine, all] = await c.env.LOGS.batch([
    c.env.LOGS.prepare(
      "SELECT count(*) AS n FROM login_attempts WHERE ip_hash = ?1 AND at > ?2 AND ok = 0",
    ).bind(ip, since),
    c.env.LOGS.prepare("SELECT count(*) AS n FROM login_attempts WHERE at > ?1 AND ok = 0").bind(since),
  ]);
  const n = (r: typeof mine) => (r?.results?.[0] as { n: number } | undefined)?.n ?? 0;
  return n(mine) >= IP_FAILURES || n(all) >= GLOBAL_FAILURES;
}

/** Step 1: email a code if the address is an admin. Always answers the same. */
export async function startLogin(c: Context<AppContext>, rawEmail: string) {
  if (!adminConfigured(c)) fail(503, "Email sign-in isn't set up yet");
  requireSameOrigin(c);
  const email = rawEmail.trim().toLowerCase();
  if (await lockedOut(c, await ipHash(c))) fail(429, "Too many tries. Please wait 15 minutes.");
  const allowed = adminEmails(c);
  let isAdmin = false;
  for (const a of allowed) if (await safeEqual(email, a)) isAdmin = true;
  if (!isAdmin) return;

  const now = Date.now();
  const recent = await c.env.DB.prepare(
    "SELECT count(*) AS n FROM admin_login_codes WHERE email = ?1 AND created_at > ?2",
  )
    .bind(email, now - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= CODES_PER_HOUR) return; // quietly stop: no email flood

  const id = randomToken(12);
  const code = sixDigits();
  await c.env.DB.batch([
    // A new code cancels any earlier unused one.
    c.env.DB.prepare("UPDATE admin_login_codes SET used_at = ?1 WHERE email = ?2 AND used_at IS NULL").bind(
      now,
      email,
    ),
    c.env.DB.prepare(
      "INSERT INTO admin_login_codes (id, email, code_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    ).bind(id, email, await codeHash(c, id, code), now, now + CODE_MS),
  ]);
  const sent = await sendMail(c.env, {
    kind: "admin.code",
    to: email,
    ref: id,
    subject: "Your admin sign-in code",
    html: `<!doctype html><html><body style="margin:0;background:#fdf9f0;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 20px;color:#1e1a14">
<p style="margin:0;color:#8f6514;font-size:12px;letter-spacing:3px;font-weight:bold">TAROT BY SATAKSHI · ADMIN</p>
<h1 style="font-family:Georgia,serif;font-weight:normal">Your sign-in code</h1>
<p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:20px 0">${escapeHtml(code)}</p>
<p style="color:#5a5145;line-height:1.6">It works once, for 10 minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.</p>
</div></body></html>`,
  });
  if (!sent) fail(502, "The sign-in email couldn't be sent. Please check the Resend setup and try again.");
}

/** Step 2: check the code and start a session. */
export async function finishLogin(c: Context<AppContext>, rawEmail: string, code: string) {
  if (!adminConfigured(c)) fail(503, "Email sign-in isn't set up yet");
  requireSameOrigin(c);
  const email = rawEmail.trim().toLowerCase();
  const ip = await ipHash(c);
  if (await lockedOut(c, ip)) fail(429, "Too many tries. Please wait 15 minutes.");
  const now = Date.now();

  // Count the try first (atomic), so parallel guesses can't exceed the limit.
  const row = await c.env.DB.prepare(
    `UPDATE admin_login_codes SET attempts = attempts + 1
     WHERE id = (SELECT id FROM admin_login_codes WHERE email = ?1 AND used_at IS NULL AND expires_at > ?2
                 ORDER BY created_at DESC LIMIT 1)
       AND attempts < ?3
     RETURNING id, code_hash`,
  )
    .bind(email, now, CODE_TRIES)
    .first<{ id: string; code_hash: string }>();

  let ok = false;
  if (row && (await safeEqual(await codeHash(c, row.id, code), row.code_hash))) {
    const used = await c.env.DB.prepare(
      "UPDATE admin_login_codes SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL",
    )
      .bind(now, row.id)
      .run();
    ok = used.meta.changes > 0;
  }
  await c.env.LOGS.prepare("INSERT INTO login_attempts (at, ip_hash, ok) VALUES (?1, ?2, ?3)")
    .bind(now, ip, ok ? 1 : 0)
    .run();
  if (!ok) fail(401, "That code is wrong or has expired. Ask for a new one.");

  const token = randomToken(32);
  await c.env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(await sha256Hex(token), email, now, now + SESSION_MS)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    maxAge: SESSION_MS / 1000,
  });
  return email;
}

export async function logout(c: Context<AppContext>, everywhere = false) {
  const token = getCookie(c, SESSION_COOKIE);
  if (everywhere) await c.env.DB.prepare("DELETE FROM admin_sessions").run();
  else if (token)
    await c.env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?1")
      .bind(await sha256Hex(token))
      .run();
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}

/** Every /api/admin route except sign-in runs behind this. */
export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || token.length < 30 || token.length > 60) fail(401, "Please sign in");
  const row = await c.env.DB.prepare(
    "SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?1 AND expires_at > ?2",
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ email: string; expires_at: number }>();
  // An address removed from ADMIN_EMAILS loses access at once, even with a live session.
  if (!row || !adminEmails(c).includes(row.email)) fail(401, "Please sign in");
  if (c.req.method !== "GET" && c.req.method !== "HEAD") requireSameOrigin(c);
  c.set("adminEmail", row.email);
  c.set("sessionExpires", row.expires_at);
  await next();
};
