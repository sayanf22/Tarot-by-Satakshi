import { z } from "zod";
import { fail } from "./http";

// Categories the client creates in the admin (Tarot, Astrology, and any others).
// Every write goes through these rules, so the admin can't store markup, odd addresses or more
// than MAX_CATEGORIES. The database adds its own checks on top (see migration 0006).

export const MAX_CATEGORIES = 20;

/** The web address part of a category: lowercase letters, numbers and dashes, 3 to 40 characters. */
export const CATEGORY_SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Letters in any language, digits, spaces and a few punctuation marks. Never markup. */
const NAME_CHARS = /^[\p{L}\p{N}][\p{L}\p{N} &'().,/-]*$/u;
const DESCRIPTION_CHARS = /^[^<>]*$/;

const name = z
  .string()
  .trim()
  .min(2, "A category name needs at least 2 characters")
  .max(40, "A category name can be up to 40 characters")
  .regex(NAME_CHARS, "Use letters, numbers, spaces and simple punctuation only");

/** Optional: a missing description is saved as empty. */
const description = z
  .string()
  .trim()
  .max(200, "The description can be up to 200 characters")
  .regex(DESCRIPTION_CHARS, "The description can't contain < or >")
  .default("");

/** Create: the web address is made from the name unless one is typed (it can't change later). */
export const categoryCreate = z.object({
  name,
  description,
  birthDetails: z.boolean(),
  active: z.boolean().default(true),
  slug: z
    .string()
    .trim()
    .regex(CATEGORY_SLUG, "The web address: lowercase letters, numbers and dashes")
    .optional(),
});

/** Edit: everything except the web address, which stays the same for the category's life. */
export const categoryUpdate = z.object({
  name,
  description,
  birthDetails: z.boolean(),
  active: z.boolean(),
});

export const categoryReorder = z.object({
  slugs: z.array(z.string().regex(CATEGORY_SLUG)).min(1).max(MAX_CATEGORIES),
});

/**
 * A web address from a name: "Numerology & Palm" → "numerology-and-palm". Names with no Latin
 * letters (e.g. Hindi only) give nothing usable, so the admin is asked to type one instead.
 */
export function slugFromName(input: string) {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  if (!CATEGORY_SLUG.test(slug))
    fail(400, "Type a short English web address for this category, e.g. numerology");
  return slug;
}

/** Whether a category exists (any state). */
export async function findCategory(db: D1Database, slug: string) {
  return db
    .prepare("SELECT slug, name, birth_details, active FROM categories WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; name: string; birth_details: number; active: number }>();
}

/**
 * A plan can be put into a category only while that category is shown. Editing a plan that is
 * already in a hidden category is allowed as long as its category is left as it is.
 */
export async function requireShownCategory(db: D1Database, slug: string) {
  const cat = await findCategory(db, slug);
  if (!cat) fail(400, "Choose a category for this plan");
  if (cat.active !== 1) fail(400, "That category is hidden. Show it again on the Categories list first.");
  return cat;
}
