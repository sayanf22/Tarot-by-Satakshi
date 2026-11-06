// Public settings used in the browser. Nothing here is secret.

/**
 * Turnstile site key (widget "guidancebysatakshi.com (Spin)"; domains guidancebysatakshi.com,
 * www, workers.dev, localhost). The Worker's TURNSTILE_SECRET belongs to this widget, so
 * the key and the secret must always be changed together.
 */
const TURNSTILE_SITE_KEY = "0x4AAAAAAF2Wu0OYsUadFDFb";
/** Cloudflare's always-pass test key, used on localhost (the Worker skips the check there). */
const TURNSTILE_TEST_KEY = "1x00000000000000000000AA";

export function turnstileSiteKey() {
  if (typeof window === "undefined") return TURNSTILE_SITE_KEY;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? TURNSTILE_TEST_KEY : TURNSTILE_SITE_KEY;
}
