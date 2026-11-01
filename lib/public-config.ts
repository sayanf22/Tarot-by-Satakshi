// Public settings used in the browser. Nothing here is secret.

/** Turnstile site key (widget "Tarot by Satakshi forms"). Add new domains to the widget in the dashboard. */
const TURNSTILE_SITE_KEY = "0x4AAAAAAFvZGPKlSutXlmeV";
/** Cloudflare's always-pass test key, used on localhost (the real key only works on listed domains). */
const TURNSTILE_TEST_KEY = "1x00000000000000000000AA";

export function turnstileSiteKey() {
  if (typeof window === "undefined") return TURNSTILE_SITE_KEY;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? TURNSTILE_TEST_KEY : TURNSTILE_SITE_KEY;
}
