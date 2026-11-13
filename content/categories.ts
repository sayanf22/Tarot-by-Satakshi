import type { CategoryInfo } from "@/lib/types";
import live from "./categories.live.json";

// Categories the client has created in the admin (Plans → Categories), saved before each build.
// The pages also refresh this list from /api/services, so a new category shows without a rebuild.
export const categories: readonly CategoryInfo[] = live.categories;
