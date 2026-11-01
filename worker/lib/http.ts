import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "../env";

/** Throws a JSON error the client can show. Messages are generic on purpose. */
export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503, message: string): never {
  throw new HTTPException(status, {
    res: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  });
}

/**
 * Requests that change data must come from this site (a matching Origin header),
 * which blocks cross-site form posts even without cookies.
 */
export function requireSameOrigin(c: Context<AppContext>) {
  const origin = c.req.header("Origin");
  if (!origin || origin !== new URL(c.req.url).origin) fail(403, "Request not allowed");
}

/** Reads a JSON body of at most `maxBytes`, checking the content type first. */
export async function readJson(c: Context<AppContext>, maxBytes = 16_384): Promise<unknown> {
  const type = c.req.header("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) fail(415, "Send JSON");
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > maxBytes) fail(413, "Request too large");
  const text = await c.req.text();
  if (text.length > maxBytes) fail(413, "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    fail(400, "Invalid request");
  }
}

/** The visitor's IP as Cloudflare sees it. Never stored as is. */
export function clientIp(c: Context<AppContext>) {
  return c.req.header("CF-Connecting-IP") ?? "local";
}

const encoder = new TextEncoder();

/** Hex SHA-256, used for salted IP hashes. */
export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Random URL-safe id, e.g. booking references and image keys. */
export function randomId(bytes = 12) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Booking reference: TS- and 8 characters without look-alikes (no 0/O, 1/I/L). */
export function bookingRef() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = crypto.getRandomValues(new Uint8Array(8));
  return `TS-${[...buf].map((b) => alphabet[b % alphabet.length]).join("")}`;
}
