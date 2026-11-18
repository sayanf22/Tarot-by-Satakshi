import type { Metadata } from "next";
import { site } from "@/lib/site";

/** The one address Google should list (the apex domain, over https). */
export const SITE_URL = "https://guidancebysatakshi.com";

/** Share preview for WhatsApp, Facebook, X and others (1200 × 630, made by scripts/make-og.mjs). */
export const shareImage = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: `${site.name}: tarot and astrology readings on call or text`,
};

/**
 * Metadata for a public page: title, description, its canonical address and matching
 * share-preview tags. Each page passes its own path, so www and workers.dev copies point here.
 */
export function pageMeta({
  title,
  description,
  path,
}: {
  title?: string;
  description: string;
  path: string;
}): Metadata {
  const shareTitle = title ? `${title} | ${site.name}` : `${site.name} | Tarot & Astrology Readings`;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_IN",
      url: path,
      title: shareTitle,
      description,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [shareImage.url] },
  };
}
