import type { Context } from "hono";
import type { AppContext } from "../env";
import { clientIp, fail } from "./http";

/**
 * Checks a Turnstile token server-side when TURNSTILE_SECRET is set.
 * Without the secret (local work, or before the widget exists) the check is off;
 * rate limits still apply.
 */
export async function verifyTurnstile(c: Context<AppContext>, token: unknown) {
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) return;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048)
    fail(403, "Please complete the check");
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", clientIp(c));
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean; hostname?: string };
  if (!out.success || out.hostname !== new URL(c.req.url).hostname) fail(403, "Please complete the check");
}
