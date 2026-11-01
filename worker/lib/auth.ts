import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../env";
import { randomToken, safeEqual, sha256Hex, verifyTotp } from "./crypto";
import { clientIp, fail, requireSameOrigin } from "./http";

// Admin sign-in without Cloudflare Access (which needs a card on file):
// a long passphrase AND a 6-digit code from an authenticator app (two factors).
// - Both secrets live in Worker secrets, never in the database or the code.
// - Each code works once (the last used step is stored), so a seen code can't be replayed.
// - 5 tries a minute per IP (rate-limit binding), and a lockout after 10 failures
//   in 15 minutes from anywhere, which stops slow distributed guessing.
// - The session is a random token in a __Host- cookie (HttpOnly, Secure,
//   SameSite=Strict); only its SHA-256 is stored, so a database leak gives no session.

export const SESSION_COOKIE = "__Host-tbs_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const LOCKOUT_FAILURES = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_ACTOR = "admin";

export function adminConfigured(c: Context<AppContext>) {
  return Boolean(c.env.ADMIN_PASSWORD && c.env.ADMIN_PASSWORD.length >= 16 && c.env.ADMIN_TOTP_SECRET);
}

async function ipHash(c: Context<AppContext>) {
  return (await sha256Hex(`${c.env.RATE_LIMIT_SALT ?? "dev"}:${clientIp(c)}`)).slice(0, 32);
}

export async function login(c: Context<AppContext>, password: string, code: string) {
  if (!adminConfigured(c)) fail(503, "Admin sign-in isn't set up yet");
  requireSameOrigin(c);
  const now = Date.now();

  const recent = await c.env.LOGS.prepare("SELECT count(*) AS n FROM login_attempts WHERE at > ?1 AND ok = 0")
    .bind(now - LOCKOUT_WINDOW_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= LOCKOUT_FAILURES) fail(429, "Too many failed sign-ins. Please wait 15 minutes.");

  const passwordOk = await safeEqual(password, c.env.ADMIN_PASSWORD!);
  const step = await verifyTotp(c.env.ADMIN_TOTP_SECRET!, code, now);
  let ok = passwordOk && step !== null;

  if (ok) {
    // Accept each code once: the step must be newer than the last one used.
    const res = await c.env.DB.prepare(
      `UPDATE settings SET value = ?1 WHERE key = 'totp_last_step' AND CAST(value AS INTEGER) < ?1`,
    )
      .bind(step)
      .run();
    ok = res.meta.changes > 0;
  }

  await c.env.LOGS.prepare("INSERT INTO login_attempts (at, ip_hash, ok) VALUES (?1, ?2, ?3)")
    .bind(now, await ipHash(c), ok ? 1 : 0)
    .run();
  if (!ok) fail(401, "That password or code is not right");

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
    "SELECT email FROM admin_sessions WHERE token_hash = ?1 AND expires_at > ?2",
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ email: string }>();
  if (!row) fail(401, "Please sign in");
  // Changes must come from the admin page itself.
  if (c.req.method !== "GET" && c.req.method !== "HEAD") requireSameOrigin(c);
  c.set("adminEmail", row.email);
  await next();
};
