import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";
import { services } from "@/content/services";

export const metadata: Metadata = pageMeta({
  title: "Book a Session",
  description:
    "Choose a tarot or astrology reading, pick a time and book your session with Satakshi, on call or text. Pay online and get a confirmation email.",
  path: "/book",
});

export default function BookPage() {
  return (
    <>
      <PageIntro eyebrow="Book a session" title="Book your reading" />
      <Container className="py-12 lg:py-16">
        {/* The flow reads ?service= from the URL, so it renders in the browser. */}
        <Suspense fallback={<p className="py-20 text-center text-ink-muted">Loading booking…</p>}>
          <BookingFlow services={services} />
        </Suspense>
      </Container>
    </>
  );
}
