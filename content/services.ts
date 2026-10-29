import type { Service } from "@/lib/types";

// SAMPLE SERVICES: layout preview only.
// Satakshi is writing her real categories, services, durations and prices.
// Replace this list with hers. Do not publish prices or durations until she confirms them.
// In phase 4 this list moves to D1 and is edited from the admin dashboard.
export const services: readonly Service[] = [
  {
    slug: "tarot-reading",
    name: "Tarot Reading",
    category: "tarot",
    summary: "Guidance on the question on your mind.",
    icon: "cards",
    card: "priestess",
    formats: ["call", "text"],
    sample: true,
  },
  {
    slug: "love-and-relationships",
    name: "Love & Relationships",
    category: "tarot",
    summary: "A reading on love, partners and connection.",
    icon: "heart",
    card: "two-cups",
    formats: ["call", "text"],
    sample: true,
  },
  {
    slug: "career-and-money",
    name: "Career & Money",
    category: "tarot",
    summary: "A reading on work, career and money.",
    icon: "sun",
    card: "ace-pentacles",
    formats: ["call", "text"],
    sample: true,
  },
  {
    slug: "astrology-reading",
    name: "Astrology Reading",
    category: "astrology",
    summary: "Guidance from your birth chart.",
    icon: "wheel",
    card: "wheel",
    formats: ["call", "text"],
    sample: true,
  },
  {
    slug: "general-guidance",
    name: "General Guidance",
    category: "tarot",
    summary: "An open reading on where you are now.",
    icon: "star",
    card: "hermit",
    formats: ["call", "text"],
    sample: true,
  },
];

export function getService(slug: string | null | undefined) {
  return services.find((s) => s.slug === slug);
}
