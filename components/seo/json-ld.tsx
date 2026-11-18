import photos from "@/content/photos.json";
import { SITE_URL } from "@/lib/seo";
import { site } from "@/lib/site";

// Structured data for Google (schema.org). Only facts Satakshi confirmed: name, owner, phone,
// email, city and state, opening hours, what she offers, and the award she sent.
// No ratings, reviews, prices or street address are claimed here.

const business = {
  "@type": "ProfessionalService",
  "@id": `${SITE_URL}/#business`,
  name: site.name,
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/og.jpg`,
  logo: `${SITE_URL}/apple-icon.png`,
  description: "Personal tarot and astrology readings with Satakshi Kapoor, on a phone call or over text.",
  telephone: "+91-92202-19801",
  email: site.email,
  founder: { "@id": `${SITE_URL}/#satakshi` },
  areaServed: { "@type": "Country", name: "India" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Noida",
    addressRegion: "Uttar Pradesh",
    addressCountry: "IN",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "11:00",
      closes: "21:00",
    },
  ],
  knowsAbout: ["Tarot reading", "Astrology", "Akashic record reading"],
};

const person = {
  "@type": "Person",
  "@id": `${SITE_URL}/#satakshi`,
  name: site.owner,
  jobTitle: "Tarot and Akashic Record Reader",
  url: `${SITE_URL}/about`,
  image: `${SITE_URL}${photos.portrait.sources[1]!.src}`,
  worksFor: { "@id": `${SITE_URL}/#business` },
  award: "HERstory Times Inspiration Awards 2024",
};

const website = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: site.name,
  url: `${SITE_URL}/`,
  inLanguage: "en-IN",
  publisher: { "@id": `${SITE_URL}/#business` },
};

const graphs = {
  home: [website, business, person],
  about: [person, business],
} as const;

export function JsonLd({ page }: { page: keyof typeof graphs }) {
  const data = { "@context": "https://schema.org", "@graph": graphs[page] };
  return (
    <script
      type="application/ld+json"
      // Escaping "<" keeps the JSON from closing the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
