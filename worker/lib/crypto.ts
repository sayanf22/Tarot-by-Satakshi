// Small Web Crypto helpers. All comparisons of secrets are constant-time.

const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacKey(secret: string | Uint8Array, hash: "SHA-256" | "SHA-1") {
  const raw = typeof secret === "string" ? encoder.encode(secret) : secret;
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash }, false, ["sign"]);
}

export async function hmacSha256Hex(secret: string, message: string | Uint8Array) {
  const key = await hmacKey(secret, "SHA-256");
  const data = typeof message === "string" ? encoder.encode(message) : message;
  return toHex(await crypto.subtle.sign("HMAC", key, data));
}

/**
 * Constant-time string comparison. Both sides are hashed first so their lengths
 * match and nothing about the length leaks.
 */
export async function safeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb) && a.length === b.length;
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

// ---- TOTP (RFC 6238): 6 digits, 30-second steps, SHA-1, as authenticator apps use ----

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function totpAt(secret: Uint8Array, step: number) {
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(step));
  const key = await hmacKey(secret, "SHA-1");
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = mac[19]! & 0x0f;
  const code =
    (((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!) %
    1_000_000;
  return String(code).padStart(6, "0");
}

/**
 * Checks a 6-digit code against the current step and one step either side (for
 * clock drift). Returns the matching step, so the caller can refuse a code that
 * was already used, or null.
 */
export async function verifyTotp(secretBase32: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  if (secret.length < 10) return null;
  const step = Math.floor(now / 30_000);
  for (const s of [step, step - 1, step + 1]) {
    if (await safeEqual(await totpAt(secret, s), code)) return s;
  }
  return null;
}
