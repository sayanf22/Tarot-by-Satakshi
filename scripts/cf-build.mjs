// Wrangler runs this before it uploads (see "build" in wrangler.jsonc), so
// `wrangler deploy` on Cloudflare Workers Builds creates ./out even when no build
// command is set in the dashboard. Local `wrangler dev` and `wrangler types` skip
// it: run `npm run build` yourself before previewing.
import { execSync } from "node:child_process";

const command = process.env.WRANGLER_COMMAND ?? "";

if (command === "dev" || command === "types") {
  console.log(`cf-build: skipped for wrangler ${command}`);
} else {
  execSync("npm run build", { stdio: "inherit" });
}
