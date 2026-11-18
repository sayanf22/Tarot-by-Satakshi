import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Built once into out/robots.txt. Cloudflare may add its own content-signal lines above these.
// The admin and booking-status pages also carry noindex, so they stay out even if linked.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/book/status"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
