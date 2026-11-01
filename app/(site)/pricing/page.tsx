import type { Metadata } from "next";
import { ArrowRight, MessageCircle, PhoneCall } from "lucide-react";
import { TextLink } from "@/components/legal/legal-page";
import { PageIntro } from "@/components/layout/page-intro";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { services } from "@/content/services";
import { formatDuration, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { categoryLabels, sessionLabel, type Service } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pricing",
  description: "What each tarot and astrology reading costs with Satakshi, in Indian rupees (INR).",
};

type PricedService = Service & { pricePaise: number };

// Only readings with a set price are listed. The list comes from the admin at build time.
const priced = services.filter(
  (s): s is PricedService => typeof s.pricePaise === "number" && s.pricePaise > 0,
);

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Prices"
        description="All prices are in Indian rupees (INR). You pay for a reading when you book it."
      />
      <Container className="max-w-4xl py-16 lg:py-20">
        {priced.length === 0 ? (
          <div className="rounded-[32px] bg-ivory px-6 py-12 text-center ring-1 ring-line sm:px-10">
            <h2 className="text-3xl">Prices are being added</h2>
            <p className="mx-auto mt-4 max-w-md text-ink">
              Online prices will appear here once they are set. To ask about a reading now, call or send a
              message to {site.firstName}.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href={site.phone.href} className={buttonClasses({ variant: "outline" })}>
                <PhoneCall className="size-4" strokeWidth={1.9} aria-hidden="true" />
                Call
              </a>
              <ButtonLink href="/contact">
                <MessageCircle className="size-4" strokeWidth={1.9} aria-hidden="true" />
                Message
              </ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-[32px] bg-white ring-1 ring-line">
            {priced.map((s) => (
              <li
                key={s.slug}
                className="flex flex-col gap-6 border-b border-line p-6 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:p-8"
              >
                <div className="min-w-0">
                  <p className="eyebrow">{categoryLabels[s.category]}</p>
                  <h2 className="mt-2 text-2xl">{s.name}</h2>
                  <p className="mt-2 text-ink">{s.summary}</p>
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {sessionLabel(s.formats)}
                    {s.durationMin ? ` · ${formatDuration(s.durationMin)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 sm:shrink-0 sm:flex-col sm:items-end">
                  <p className="font-display text-3xl text-ink tabular">{formatPrice(s.pricePaise)}</p>
                  <ButtonLink href={`/book?service=${s.slug}`} variant="outline">
                    Book this reading
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-ink">
          Before you pay, please read our{" "}
          <TextLink href="/refund-policy">refund and cancellation policy</TextLink> and our{" "}
          <TextLink href="/terms">terms and conditions</TextLink>.
        </p>
      </Container>
    </>
  );
}
