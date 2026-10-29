import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/page-intro";
import { BookingCta } from "@/components/sections/booking-cta";
import { FaqList } from "@/components/sections/faq-list";
import { Reveal } from "@/components/motion/reveal";
import { ServiceCard } from "@/components/services/service-card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { services } from "@/content/services";
import { categoryLabels, type ServiceCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Tarot and astrology readings with Satakshi, on call or text. Choose a reading and book a time.",
};

const order: ServiceCategory[] = ["tarot", "astrology"];

export default function ServicesPage() {
  // Keep each card's numeral the same as on the home carousel.
  const numbered = services.map((service, index) => ({ service, index }));
  const groups = order
    .map((category) => ({ category, items: numbered.filter(({ service }) => service.category === category) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="Readings"
        description="Choose a reading, then pick a time that suits you."
      />

      <div className="py-20 lg:py-28">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`cat-${group.category}`} className="mb-20 last:mb-0">
            <Container>
              <div className="flex items-center gap-5">
                <h2 id={`cat-${group.category}`} className="text-3xl sm:text-4xl">
                  {categoryLabels[group.category]}
                </h2>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-linear-to-r from-gold-500 to-transparent"
                />
              </div>
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map(({ service, index }, i) => (
                  <li key={service.slug}>
                    <Reveal delay={(i % 4) * 80} className="h-full">
                      <ServiceCard service={service} index={index} />
                    </Reveal>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ))}
      </div>

      <section className="py-20 lg:py-24">
        <Container>
          <SectionHeading eyebrow="Before you book" title="Good to know" />
          <Reveal className="mt-12">
            <FaqList />
          </Reveal>
        </Container>
      </section>

      <BookingCta />
    </>
  );
}
