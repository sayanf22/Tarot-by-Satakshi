import type { Service } from "@/lib/types";
import home from "./home.live.json";
import live from "./services.live.json";

// Plans come from D1 and are managed in the admin. scripts/fetch-services.mjs saves
// the live list to services.live.json before each build ("Publish to website").
// There is no sample list: with no plans, the pages show "Readings are being added".
export const services: readonly Service[] = live as Service[];

/** How many plans the home page deck shows, chosen in the admin (3 to 12). */
export const homeCards: number = Number.isInteger(home.homeCards)
  ? Math.min(12, Math.max(3, home.homeCards))
  : 6;

export function getService(slug: string | null | undefined) {
  return services.find((s) => s.slug === slug);
}
