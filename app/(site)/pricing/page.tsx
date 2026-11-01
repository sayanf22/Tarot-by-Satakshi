import type { Metadata } from "next";
import { TextLink } from "@/components/legal/legal-page";
import { PageIntro } from "@/components/layout/page-intro";
import { PricingList } from "@/components/pricing/pricing-list";
import { Container } from "@/components/ui/container";
import { services } from "@/content/services";

export const metadata: Metadata = {
  title: "Pricing",
  description: "What each tarot and astrology reading costs with Satakshi, in Indian rupees (INR).",
};

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Prices"
        description="All prices are in Indian rupees (INR). You pay for a reading when you book it."
      />
      <Container className="max-w-4xl py-16 lg:py-20">
        {/* Built with the plans saved at build time, then refreshed from the live list in the browser. */}
        <PricingList built={services} />
        <p className="mt-10 text-ink">
          Before you pay, please read our{" "}
          <TextLink href="/refund-policy">refund and cancellation policy</TextLink> and our{" "}
          <TextLink href="/terms">terms and conditions</TextLink>.
        </p>
      </Container>
    </>
  );
}
