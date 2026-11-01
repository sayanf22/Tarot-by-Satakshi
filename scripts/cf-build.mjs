// Wrangler runs this before it uploads (see "build" in wrangler.jsonc), so
// `wrangler deploy` on Cloudflare Workers Builds creates ./out even when no build
// command is set in the dashboard. Local `wrangler dev` and `wrangler types` skip
// it: run `npm run build` yourself before previewing.
// On Workers Builds (WORKERS_CI=1) with the dashboard build command set, ./out
// already exists from that step, so the site isn't built twice.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const command = process.env.WRANGLER_COMMAND ?? "";

if (command === "dev" || command === "types") {
  console.log(`cf-build: skipped for wrangler ${command}`);
} else if (process.env.WORKERS_CI === "1" && existsSync("out/index.html")) {
  console.log("cf-build: ./out was built by the build step; skipping");
} else {
  execSync("npm run build", { stdio: "inherit" });
}
