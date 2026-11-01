import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppContext } from "../env";
import { fail } from "./http";

// Cloudflare Access signs a JWT for every request it lets through. The Worker
// checks it on every admin call: signature (Access public keys), issuer, audience
// (the Access application's AUD tag), expiry, and that the email is an admin.
// Without ACCESS_TEAM_DOMAIN and ACCESS_AUD set, every admin call is refused.

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer = "";

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const team = c.env.ACCESS_TEAM_DOMAIN.trim();
  const aud = c.env.ACCESS_AUD.trim();
  if (!team || !aud) fail(503, "Admin sign-in isn't set up yet");

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) fail(401, "Please sign in");

  const issuer = `https://${team.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  if (!jwks || jwksIssuer !== issuer) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksIssuer = issuer;
  }

  let email = "";
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: aud });
    email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  } catch {
    fail(401, "Please sign in");
  }

  const admins = c.env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !admins.includes(email)) fail(403, "Not allowed");

  c.set("adminEmail", email);
  await next();
};
