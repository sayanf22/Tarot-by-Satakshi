import type { Metadata } from "next";
import { TurnableReadingCard } from "@/components/cards/reading-card";
import { PageIntro } from "@/components/layout/page-intro";
import { Reveal } from "@/components/motion/reveal";
import { AskPanel } from "@/components/sections/ask-panel";
import { BookingCta } from "@/components/sections/booking-cta";
import { FaqList } from "@/components/sections/faq-list";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
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
  const groups = order
    .map((category) => ({ category, items: services.filter((s) => s.category === category) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="Readings"
        description="Hover or tap a card to turn it, then book the reading that fits your question."
      />

      <div className="overflow-x-clip py-20 lg:py-28">
        {groups.map((group) => (
          <section
            key={group.category}
            aria-label={categoryLabels[group.category]}
            className="mb-24 last:mb-0"
          >
            <Container>
              <RuleTitle title={categoryLabels[group.category]} />
              <ul className="mt-12 flex flex-wrap justify-center gap-6">
                {group.items.map((service, i) => (
                  <li key={service.slug} className="w-[min(100%,260px)]">
                    <Reveal delay={(i % 4) * 90}>
                      <TurnableReadingCard service={service} />
                    </Reveal>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ))}
      </div>

      <section className="py-20 lg:py-24">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Before you book" title="Good to know" />
          <Reveal className="mt-12">
            <FaqList />
          </Reveal>
          <Reveal className="mt-10">
            <AskPanel />
          </Reveal>
        </Container>
      </section>

      <BookingCta />
    </>
  );
}
