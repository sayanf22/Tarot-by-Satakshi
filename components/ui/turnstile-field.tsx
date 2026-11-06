"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";
import { turnstileSiteKey } from "@/lib/public-config";

type Props = {
  /** Which form this protects. The Worker accepts the token only for this action. */
  action: "contact" | "booking";
  onToken: (token: string | null) => void;
};

/**
 * Cloudflare Turnstile check (no puzzles for most people). The token is single-use
 * and is checked by the Worker; call `reset()` on the ref after each submit.
 */
export const TurnstileField = forwardRef<TurnstileInstance | undefined, Props>(function TurnstileField(
  { action, onToken },
  ref,
) {
  return (
    <Turnstile
      ref={ref}
      siteKey={turnstileSiteKey()}
      onSuccess={(t) => onToken(t)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
      options={{ action, theme: "light", size: "flexible", refreshExpired: "auto", language: "en" }}
    />
  );
});
