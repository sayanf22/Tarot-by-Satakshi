import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "../env";

type ErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 429 | 500 | 502 | 503;

/** Throws a JSON error the client can show. Messages are generic on purpose. */
export function fail(status: ErrorStatus, message: string): never {
  throw new HTTPException(status, {
    res: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    }),
  });
}

/**
 * Requests that change data must come from this site (a matching Origin header).
 * Together with SameSite=Strict cookies this blocks cross-site requests.
 */
export function requireSameOrigin(c: Context<AppContext>) {
  const origin = c.req.header("Origin");
  if (!origin || origin !== new URL(c.req.url).origin) fail(403, "Request not allowed");
}

/** Reads a body of at most `maxBytes` as text, without trusting Content-Length. */
export async function readText(c: Context<AppContext>, maxBytes: number) {
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > maxBytes) fail(413, "Request too large");
  const body = c.req.raw.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      fail(413, "Request too large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const ch of chunks) {
    all.set(ch, at);
    at += ch.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Reads a JSON body of at most `maxBytes`, checking the content type first. */
export async function readJson(c: Context<AppContext>, maxBytes = 16_384): Promise<unknown> {
  const type = c.req.header("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) fail(415, "Send JSON");
  const text = await readText(c, maxBytes);
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
