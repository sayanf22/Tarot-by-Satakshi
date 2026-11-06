// Public settings used in the browser. Nothing here is secret.

/**
 * Turnstile site key (widget "Tarot by Satakshi forms"; domains guidancebysatakshi.com,
 * www and workers.dev). The Worker's TURNSTILE_SECRET belongs to this widget, so the
 * key and the secret must always be changed together.
 */
const TURNSTILE_SITE_KEY = "0x4AAAAAAFvZGPKlSutXlmeV";
/** Cloudflare's always-pass test key, used on localhost (the real key only works on listed domains). */
const TURNSTILE_TEST_KEY = "1x00000000000000000000AA";

export function turnstileSiteKey() {
  if (typeof window === "undefined") return TURNSTILE_SITE_KEY;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? TURNSTILE_TEST_KEY : TURNSTILE_SITE_KEY;
}
