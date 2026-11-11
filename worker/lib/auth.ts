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
// Limits: 5 requests a minute per IP (rate-limit binding), 10 codes an hour per email,
// and 10 wrong codes in 15 minutes from one IP (30 from anywhere) locks sign-in.

export const SESSION_COOKIE = "__Host-tbs_admin";
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const CODE_MS = 10 * 60 * 1000;
const CODE_TRIES = 5;
const CODES_PER_HOUR = 10;
const WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURES = 10;
const GLOBAL_FAILURES = 30;

/**
 * Super admins: fixed in wrangler.jsonc (ADMIN_EMAILS). They can't be removed from the
 * admin, and only they can add or remove other admins.
 */
export function adminEmails(c: Context<AppContext>) {
  return c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const MAX_EXTRA_ADMINS = 10;
let adminTableReady = false;

/**
 * Creates the admin_users table on first use and records migration 0005, so a live
 * database gets it without a separate migration step. No address is ever added here:
 * extra admins are added on the Account page (or by the developer straight in the database).
 */
export async function ensureAdminTable(db: D1Database) {
  if (adminTableReady) return;
  const exists = await db
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'admin_users'")
    .first();
  if (!exists)
    await db.batch([
      db.prepare(
        "CREATE TABLE IF NOT EXISTS admin_users (email TEXT PRIMARY KEY CHECK (length(email) BETWEEN 3 AND 254), added_by TEXT NOT NULL, added_at INTEGER NOT NULL)",
      ),
      db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_admin_users.sql')"),
    ]);
  adminTableReady = true;
}
/** Admins added on the Account page. */
export async function extraAdmins(c: Context<AppContext>) {
  await ensureAdminTable(c.env.DB);
  const { results } = await c.env.DB.prepare(
    "SELECT email, added_by, added_at FROM admin_users ORDER BY added_at",
  ).all<{ email: string; added_by: string; added_at: number }>();
  return results;
}

/** Is this email a super admin or an added admin? Always runs the same steps, admin or not. */
export async function isAdmin(c: Context<AppContext>, email: string) {
  let found = false;
  for (const a of adminEmails(c)) if (await safeEqual(email, a)) found = true;
  await ensureAdminTable(c.env.DB);
  const row = await c.env.DB.prepare("SELECT 1 AS x FROM admin_users WHERE email = ?1").bind(email).first();
  return found || Boolean(row);
}

export function isSuperAdmin(c: Context<AppContext>, email: string) {
  return adminEmails(c).includes(email.toLowerCase());
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

/** Gap between two code emails for one address, so nobody can flood an admin's inbox. */
const CODE_GAP_MS = 30 * 1000;

/**
 * Step 1: email a code if the address is an admin. The reply (and its speed) is the same
 * for every address: the code is made and emailed in the background, so nobody can tell
 * an admin address from any other by the answer.
 */
export async function startLogin(c: Context<AppContext>, rawEmail: string) {
  if (!adminConfigured(c)) fail(503, "Email sign-in isn't set up yet");
  requireSameOrigin(c);
  const email = rawEmail.trim().toLowerCase();
  if (await lockedOut(c, await ipHash(c))) fail(429, "Too many tries. Please wait 15 minutes.");
  if (!(await isAdmin(c, email))) return;
  c.executionCtx.waitUntil(issueCode(c, email));
}

async function issueCode(c: Context<AppContext>, email: string) {
  try {
    const now = Date.now();
    const recent = await c.env.DB.prepare(
      "SELECT count(*) AS n, max(created_at) AS last FROM admin_login_codes WHERE email = ?1 AND created_at > ?2",
    )
      .bind(email, now - 60 * 60 * 1000)
      .first<{ n: number; last: number | null }>();
    if ((recent?.n ?? 0) >= CODES_PER_HOUR) return; // quietly stop: no email flood
    if (recent?.last && now - recent.last < CODE_GAP_MS) return; // too soon after the last one

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
    await sendMail(c.env, {
      kind: "admin.code",
      to: email,
      ref: id,
      subject: "Your admin sign-in code",
      html: `<!doctype html><html><body style="margin:0;background:#fdf9f0;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 20px;color:#1e1a14">
<p style="margin:0;color:#8f6514;font-size:12px;letter-spacing:3px;font-weight:bold">TAROT BY SATAKSHI · ADMIN</p>
<h1 style="font-family:Georgia,serif;font-weight:normal">Your sign-in code</h1>
<p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:20px 0">${escapeHtml(code)}</p>
<p style="color:#5a5145;line-height:1.6">It works once, for 10 minutes. Only type it on guidancebysatakshi.com/admin. Never share it, read it out on a call or type it on any other website: Tarot by Satakshi and WhyCreatives will never ask you for it.</p>
<p style="color:#5a5145;line-height:1.6">This email never contains a link. If you didn't ask for a code, ignore it: nobody can sign in without the code.</p>
</div></body></html>`,
    });
  } catch (err) {
    console.error("sign-in code failed", err instanceof Error ? err.message : "");
  }
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
  if (ok && !(await isAdmin(c, email))) ok = false; // removed since the code was sent
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

/**
 * After every successful sign-in, email that admin with the time and rough location
 * (Cloudflare's country and city; the IP itself is not stored or sent). If it wasn't
 * them, "Sign out on all devices" in Account ends every session.
 */
export async function sendSignInAlert(c: Context<AppContext>, email: string) {
  const cf = (c.req.raw as Request & { cf?: { country?: string; city?: string } }).cf;
  const where = [cf?.city, cf?.country].filter(Boolean).join(", ") || "Unknown";
  const device = (c.req.header("User-Agent") ?? "Unknown").slice(0, 160);
  const when = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(Date.now());
  await sendMail(c.env, {
    kind: "admin.signin",
    to: email,
    ref: `${Date.now()}`,
    subject: "New sign-in to the admin",
    html: `<!doctype html><html><body style="margin:0;background:#fdf9f0;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 20px;color:#1e1a14">
<p style="margin:0;color:#8f6514;font-size:12px;letter-spacing:3px;font-weight:bold">TAROT BY SATAKSHI · ADMIN</p>
<h1 style="font-family:Georgia,serif;font-weight:normal">New sign-in</h1>
<p style="line-height:1.6">Your admin account (${escapeHtml(email)}) was just signed in.</p>
<p style="line-height:1.6">When: ${escapeHtml(when)} IST<br>Where (approximate): ${escapeHtml(where)}<br>Device: ${escapeHtml(device)}</p>
<p style="color:#5a5145;line-height:1.6">If this was you, nothing to do. If it wasn't, open the admin, go to Account and choose "Sign out everywhere", then tell WhyCreatives.</p>
</div></body></html>`,
  });
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
  // A removed admin loses access at once, even with a live session.
  if (!row || !(await isAdmin(c, row.email))) fail(401, "Please sign in");
  if (c.req.method !== "GET" && c.req.method !== "HEAD") requireSameOrigin(c);
  c.set("adminEmail", row.email);
  c.set("sessionExpires", row.expires_at);
  await next();
};
