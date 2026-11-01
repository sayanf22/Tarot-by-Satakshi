import type { Context } from "hono";
import type { AppContext } from "../env";
import { clientIp, fail, sha256Hex } from "./http";

/**
 * Fixed-window limit counted in D1: at most `limit` requests per `windowSec` for
 * this visitor and bucket. The key is a salted hash of the IP, so no IP is stored.
 * One upsert per request, which is cheap on CPU.
 */
export async function rateLimit(c: Context<AppContext>, bucket: string, limit: number, windowSec: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000));
  const salt = c.env.RATE_LIMIT_SALT ?? "local-dev-salt";
  const key = `${bucket}:${(await sha256Hex(`${salt}:${clientIp(c)}`)).slice(0, 32)}:${windowStart}`;
  const expires = (windowStart + 1) * windowSec * 1000;

  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, count, expires_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(key, expires)
    .first<{ count: number }>();

  // Clear old windows now and then, without slowing the request.
  if (Math.random() < 0.05) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(now).run(),
    );
  }

  if ((row?.count ?? 0) > limit) fail(429, "Too many requests. Please try again later.");
}
