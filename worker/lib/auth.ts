import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../env";
import {
  hashPassword,
  hmacSha256Hex,
  newSalt,
  PASSWORD_ITERATIONS,
  randomToken,
  safeEqual,
  sha256Hex,
  verifyTotp,
} from "./crypto";
import { clientIp, fail, requireSameOrigin } from "./http";

// Admin sign-in without Cloudflare Access (which needs a card on file):
// login ID + password + a 6-digit code from an authenticator app (two factors).
// - The first password is the ADMIN_PASSWORD Worker secret. "Change password" in the
//   admin stores a peppered PBKDF2 hash in D1 instead (see migrations/core/0003).
// - Forgotten password: set a new ADMIN_PASSWORD secret in the Cloudflare dashboard;
//   the stored hash no longer matches its fingerprint, so the new secret works.
// - Each code works once (last used step stored), so a seen code can't be replayed.
// - 5 tries a minute per IP (rate-limit binding); 5 failures in 15 minutes locks that
//   IP out, and 30 failures from anywhere locks sign-in for 15 minutes.
// - Session: random token in a __Host- cookie (HttpOnly, Secure, SameSite=Strict);
//   only its SHA-256 is stored, so a database leak gives no session.

export const SESSION_COOKIE = "__Host-tbs_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURES = 5;
const GLOBAL_FAILURES = 30;
export const ADMIN_ACTOR = "admin";
export const MIN_PASSWORD = 12;

export function adminConfigured(c: Context<AppContext>) {
  return Boolean(
    c.env.ADMIN_PASSWORD &&
    c.env.ADMIN_PASSWORD.length >= 16 &&
    c.env.ADMIN_TOTP_SECRET &&
    c.env.PASSWORD_PEPPER,
  );
}

export function loginId(c: Context<AppContext>) {
  return c.env.ADMIN_LOGIN_ID.trim().toLowerCase();
}

async function ipHash(c: Context<AppContext>) {
  return (await sha256Hex(`${c.env.RATE_LIMIT_SALT ?? "dev"}:${clientIp(c)}`)).slice(0, 32);
}

async function secretFingerprint(c: Context<AppContext>) {
  return hmacSha256Hex(c.env.PASSWORD_PEPPER!, `fingerprint:${c.env.ADMIN_PASSWORD}`);
}

/** Checks a password against the D1 hash (if current) or the ADMIN_PASSWORD secret. */
async function passwordMatches(c: Context<AppContext>, password: string) {
  const row = await c.env.DB.prepare(
    "SELECT password_hash, password_salt, iterations, secret_fingerprint FROM admin_account WHERE id = 1",
  ).first<{ password_hash: string; password_salt: string; iterations: number; secret_fingerprint: string }>();
  if (row && (await safeEqual(row.secret_fingerprint, await secretFingerprint(c)))) {
    const hash = await hashPassword(password, c.env.PASSWORD_PEPPER!, row.password_salt, row.iterations);
    return safeEqual(hash, row.password_hash);
  }
  return safeEqual(password, c.env.ADMIN_PASSWORD!);
}

/** Uses up a TOTP step so the same code can't be used again. */
async function consumeStep(c: Context<AppContext>, step: number) {
  const res = await c.env.DB.prepare(
    "UPDATE settings SET value = ?1 WHERE key = 'totp_last_step' AND CAST(value AS INTEGER) < ?1",
  )
    .bind(step)
    .run();
  return res.meta.changes > 0;
}

async function startSession(c: Context<AppContext>) {
  const now = Date.now();
  const token = randomToken(32);
  await c.env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(await sha256Hex(token), ADMIN_ACTOR, now, now + SESSION_MS)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    maxAge: SESSION_MS / 1000,
  });
}

export async function login(c: Context<AppContext>, id: string, password: string, code: string) {
  if (!adminConfigured(c)) fail(503, "Admin sign-in isn't set up yet");
  requireSameOrigin(c);
  const now = Date.now();
  const ip = await ipHash(c);

  const [mine, all] = await c.env.LOGS.batch([
    c.env.LOGS.prepare(
      "SELECT count(*) AS n FROM login_attempts WHERE at > ?1 AND ok = 0 AND ip_hash = ?2",
    ).bind(now - WINDOW_MS, ip),
    c.env.LOGS.prepare("SELECT count(*) AS n FROM login_attempts WHERE at > ?1 AND ok = 0").bind(
      now - WINDOW_MS,
    ),
  ]);
  const count = (r: typeof mine) => (r?.results?.[0] as { n: number } | undefined)?.n ?? 0;
  if (count(mine) >= IP_FAILURES || count(all) >= GLOBAL_FAILURES)
    fail(429, "Too many failed sign-ins. Please wait 15 minutes.");

  // Every check runs every time, so the response time doesn't reveal which part was wrong.
  const idOk = await safeEqual(id.trim().toLowerCase(), loginId(c));
  const passwordOk = await passwordMatches(c, password);
  const step = await verifyTotp(c.env.ADMIN_TOTP_SECRET!, code, now);
  const ok = idOk && passwordOk && step !== null && (await consumeStep(c, step));

  await c.env.LOGS.prepare("INSERT INTO login_attempts (at, ip_hash, ok) VALUES (?1, ?2, ?3)")
    .bind(now, ip, ok ? 1 : 0)
    .run();
  if (!ok) fail(401, "That ID, password or code is not right");
  await startSession(c);
}

/** Password rules: long, not trivially guessable, not the ID. */
export function passwordProblem(next: string, id: string) {
  if (next.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
  if (next.length > 128) return "Use at most 128 characters";
  if (next.trim().toLowerCase() === id) return "The password can't be your login ID";
  if (/^(.)\1+$/.test(next)) return "Don't repeat one character";
  const common = ["password", "123456", "qwerty", "satakshi", "tarot", "admin", "letmein"];
  if (
    common.some(
      (w) =>
        next
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .startsWith(w) && next.length < 20,
    )
  )
    return "That password is too easy to guess";
  return null;
}

/** Change password: needs the current password and a fresh authenticator code. Signs out every other device. */
export async function changePassword(c: Context<AppContext>, current: string, next: string, code: string) {
  const now = Date.now();
  const currentOk = await passwordMatches(c, current);
  const step = await verifyTotp(c.env.ADMIN_TOTP_SECRET!, code, now);
  if (!currentOk || step === null || !(await consumeStep(c, step)))
    fail(401, "The current password or the code is not right");
  const problem = passwordProblem(next, loginId(c));
  if (problem) fail(400, problem);
  if (await safeEqual(next, current)) fail(400, "Choose a password you haven't used here");

  const salt = newSalt();
  const hash = await hashPassword(next, c.env.PASSWORD_PEPPER!, salt);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO admin_account (id, password_hash, password_salt, iterations, secret_fingerprint, updated_at)
       VALUES (1, ?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (id) DO UPDATE SET password_hash = ?1, password_salt = ?2, iterations = ?3, secret_fingerprint = ?4, updated_at = ?5`,
    ).bind(hash, salt, PASSWORD_ITERATIONS, await secretFingerprint(c), now),
    c.env.DB.prepare("DELETE FROM admin_sessions"),
  ]);
  await startSession(c);
}

export async function passwordChangedAt(c: Context<AppContext>) {
  const row = await c.env.DB.prepare(
    "SELECT updated_at, secret_fingerprint FROM admin_account WHERE id = 1",
  ).first<{
    updated_at: number;
    secret_fingerprint: string;
  }>();
  return row && (await safeEqual(row.secret_fingerprint, await secretFingerprint(c))) ? row.updated_at : null;
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
  if (!adminConfigured(c)) fail(503, "Admin sign-in isn't set up yet");
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || token.length < 30 || token.length > 60) fail(401, "Please sign in");
  const row = await c.env.DB.prepare(
    "SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?1 AND expires_at > ?2",
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ email: string; expires_at: number }>();
  if (!row) fail(401, "Please sign in");
  // Changes must come from the admin page itself.
  if (c.req.method !== "GET" && c.req.method !== "HEAD") requireSameOrigin(c);
  c.set("adminEmail", row.email);
  c.set("sessionExpires", row.expires_at);
  await next();
};
