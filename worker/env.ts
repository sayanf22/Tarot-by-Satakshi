// Bindings from wrangler.jsonc (generated `Env`) plus secrets and optional bindings.
// Secrets are set with `wrangler secret put NAME` (or `.dev.vars` locally) and are
// optional here so each feature can switch itself off cleanly when one is missing.
export type AppEnv = Env & {
  /** R2 bucket for uploaded images. Missing until R2 is turned on for the account. */
  MEDIA?: R2Bucket;
  /** Salt for hashing visitor IPs in rate-limit keys. */
  RATE_LIMIT_SALT?: string;
  /** Resend API key (sending access, one domain). */
  RESEND_API_KEY?: string;
  /** Turnstile secret key. When set, the contact and booking forms must pass Turnstile. */
  TURNSTILE_SECRET?: string;
};

export type AppContext = { Bindings: AppEnv; Variables: { adminEmail: string } };
