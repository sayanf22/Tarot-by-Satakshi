import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/page-intro";
import { Reveal } from "@/components/motion/reveal";
import { AskPanel } from "@/components/sections/ask-panel";
import { BookingCta } from "@/components/sections/booking-cta";
import { FaqList } from "@/components/sections/faq-list";
import { ServicesGrid } from "@/components/services/services-grid";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { services } from "@/content/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Tarot and astrology readings with Satakshi, on call or text. Choose a reading and book a time.",
};

export default function ServicesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="Readings"
        description="Hover or tap a card to turn it, then book the reading that fits your question."
      />

      <div className="overflow-x-clip py-20 lg:py-28">
        <ServicesGrid built={services} />
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
