import type { Service } from "@/lib/types";
import live from "./services.live.json";

// Plans come from D1 (managed in the admin). scripts/fetch-services.mjs saves the
// live list to services.live.json before each build. The sample list below is
// only used if that file is empty (for example a fresh clone with no API access).
const samples: readonly Service[] = [
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

export const services: readonly Service[] = (live as Service[]).length ? (live as Service[]) : samples;

export function getService(slug: string | null | undefined) {
  return services.find((s) => s.slug === slug);
}
