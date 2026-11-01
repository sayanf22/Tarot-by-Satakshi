import type { Context } from "hono";
import type { AppContext } from "../env";
import { clientIp, fail } from "./http";

type Limiter = "RL_READ" | "RL_FORM" | "RL_LOGIN";

/**
 * Per-visitor limit using Cloudflare's Rate Limiting binding (counted at the edge,
 * so no database rows are written). Limits are per minute; see wrangler.jsonc.
 */
export async function rateLimit(c: Context<AppContext>, limiter: Limiter, bucket: string) {
  const { success } = await c.env[limiter].limit({ key: `${bucket}:${clientIp(c)}` });
  if (!success) fail(429, "Too many requests. Please wait a minute and try again.");
}
