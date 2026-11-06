import type { Context } from "hono";
import type { AppContext } from "../env";
import { clientIp, fail } from "./http";

/** The protected forms. The browser widget sends the same action name. */
export type TurnstileAction = "contact" | "booking";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/**
 * Checks a Turnstile token server-side (siteverify) before a form is handled.
 * Passes only if Cloudflare says the token is valid and unused, was issued for this
 * form's action, and for a hostname on TURNSTILE_HOSTNAMES that matches this request.
 * Fails closed: without the secret, only local development (127.0.0.1) skips the check.
 */
export async function verifyTurnstile(c: Context<AppContext>, token: unknown, action: TurnstileAction) {
  const host = new URL(c.req.url).hostname;
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) {
    if (LOCAL_HOSTS.has(host)) return;
    fail(503, "The security check is unavailable. Please try again.");
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 2048)
    fail(403, "Please complete the security check");

  const allowed = new Set(
    (c.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowed.has(host)) fail(403, "Please complete the security check");

  let out: { success?: boolean; hostname?: string; action?: string } = {};
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: clientIp(c),
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    out = (await res.json()) as typeof out;
  } catch {
    fail(503, "The security check is unavailable. Please try again.");
  }
  if (!out.success || out.action !== action || out.hostname !== host || !allowed.has(out.hostname))
    fail(403, "Please complete the security check");
}
