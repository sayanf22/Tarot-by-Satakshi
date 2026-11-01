// Small Web Crypto helpers. All comparisons of secrets are constant-time.

const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | Uint8Array) {
  return toHex(
    await crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value),
  );
}

export async function hmacSha256Hex(secret: string, message: string | Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = typeof message === "string" ? encoder.encode(message) : message;
  return toHex(await crypto.subtle.sign("HMAC", key, data));
}

/**
 * Constant-time string comparison (Cloudflare's recommended pattern): both sides
 * are hashed to a fixed size first, so not even the length leaks.
 */
export async function safeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/** URL-safe random token. */
export function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Booking reference: TS- and 8 characters without look-alikes (no 0/O, 1/I/L). */
export function bookingRef() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 characters
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  while (out.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < 8) out.push(alphabet[b % 31]!);
    }
  }
  return `TS-${out.join("")}`;
}
