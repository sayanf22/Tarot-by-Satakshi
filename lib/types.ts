import type cards from "@/content/tarot-cards.json";

export type TarotCardId = keyof typeof cards;
/** A category's web name, e.g. "tarot". The client creates her own in the admin. */
export type ServiceCategory = string;
export type SessionFormat = "call" | "text";
export type ServiceIcon = "cards" | "heart" | "sun" | "moon" | "star" | "wheel" | "eye";

export type Service = {
  slug: string;
  name: string;
  /** The category's web name, e.g. "tarot". */
  category: ServiceCategory;
  /** The category's display name, e.g. "Tarot". Set by the API so pages need no lookup. */
  categoryName: string;
  /** True when booking asks for date, time and place of birth. */
  birthDetails: boolean;
  summary: string;
  icon: ServiceIcon;
  /** Tarot card image shown for this reading on the home page. */
  card: TarotCardId;
  formats: readonly SessionFormat[];
  /** Filled in once Satakshi confirms them. */
  durationMin?: number;
  pricePaise?: number;
  /** True for layout samples that must be replaced with her real list. */
  sample?: boolean;
  /** Set by the API: has a real price and length, so it can be paid for online. */
  bookable?: boolean;
  /** Photo chosen in the admin, served from the MEDIA databases (`/media/<key>`). */
  image?: string;
};

/** A category shown on the Services page, in the order the admin set. */
export type CategoryInfo = {
  slug: string;
  name: string;
  description: string;
  birthDetails: boolean;
};

export const formatLabels: Record<SessionFormat, string> = {
  call: "Call",
  text: "Text",
};

/** ["call", "text"] → "Call or text session". */
export function sessionLabel(formats: readonly SessionFormat[]) {
  const words = formats.map((f) => formatLabels[f].toLowerCase()).join(" or ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} session`;
}
