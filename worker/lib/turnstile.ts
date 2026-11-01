import type { Context } from "hono";
import type { AppContext } from "../env";
import { clientIp, fail } from "./http";

/**
 * Checks a Turnstile token server-side (siteverify) when TURNSTILE_SECRET is set.
 * The token must be valid, unused, and issued for this site's hostname.
 * Without the secret (local work) the check is off; rate limits still apply.
 */
export async function verifyTurnstile(c: Context<AppContext>, token: unknown) {
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) return;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048)
    fail(403, "Please complete the security check");
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", clientIp(c));
  form.append("idempotency_key", crypto.randomUUID());
  let out: { success?: boolean; hostname?: string } = {};
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    out = (await res.json()) as typeof out;
  } catch {
    fail(503, "The security check is unavailable. Please try again.");
  }
  if (!out.success || out.hostname !== new URL(c.req.url).hostname)
    fail(403, "Please complete the security check");
}
