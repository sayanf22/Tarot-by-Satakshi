// Bindings from wrangler.jsonc (generated `Env`) plus secrets.
// Secrets are set in the dashboard (Worker > Settings > Variables and Secrets) or
// with `wrangler secret put NAME`, and locally in `.dev.vars`. They are optional
// here so each feature switches itself off cleanly when its secret is missing.
export type AppEnv = Env & {
  /** Secret used to hash visitor IPs and sign-in codes before they are stored. */
  RATE_LIMIT_SALT?: string;
  /** Resend API key (sending access). Needed for admin sign-in and all emails. */
  RESEND_API_KEY?: string;
  /** Turnstile secret key. When set, the booking and contact forms must pass Turnstile. */
  TURNSTILE_SECRET?: string;
  /** Razorpay keys. Without them, online payment (and so booking) is switched off. */
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** Workers Builds deploy hook, used by "Publish to website" in the admin. */
  DEPLOY_HOOK_URL?: string;
};

export type AppContext = { Bindings: AppEnv; Variables: { adminEmail: string; sessionExpires: number } };
