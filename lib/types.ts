import type cards from "@/content/tarot-cards.json";

export type TarotCardId = keyof typeof cards;
export type ServiceCategory = "tarot" | "astrology";
export type SessionFormat = "call" | "text";
export type ServiceIcon = "cards" | "heart" | "sun" | "moon" | "star" | "wheel" | "eye";

export type Service = {
  slug: string;
  name: string;
  category: ServiceCategory;
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
};

export const categoryLabels: Record<ServiceCategory, string> = {
  tarot: "Tarot",
  astrology: "Astrology",
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
