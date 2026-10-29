import type { Metadata } from "next";
import { CalendarCheck, Clock, PhoneCall } from "lucide-react";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { BookingCta } from "@/components/sections/booking-cta";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Satakshi",
  description: "Meet Satakshi Kapoor, who offers tarot and astrology readings on call and text.",
};

// Copy uses only confirmed facts. Her story, training and approach are added
// once she shares them (WhyCreatives writes the text from her answers).
const facts = [
  { icon: PhoneCall, title: "Call or text", text: "Choose how you'd like your session when you book." },
  { icon: Clock, title: site.hours.daysShort, text: `${site.hours.time} ${site.hours.timeZone}` },
  { icon: CalendarCheck, title: "Book online", text: "Pick a time, pay and get a confirmation email." },
];

export default function AboutPage() {
  return (
    <>
      <section>
        <Container className="grid items-center gap-14 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
          {/* Framed photo; the frame takes the photo's own shape, so nothing is cropped. */}
          <div className="mx-auto w-full max-w-[440px] animate-rise">
            <div className="group grain-dark relative rounded-[36px] bg-night p-3 shadow-lift">
              <div className="overflow-hidden rounded-[28px]">
                <Photo
                  id="terrace"
                  priority
                  sizes="(min-width: 1024px) 420px, 90vw"
                  className="h-auto w-full transition-transform duration-1000 ease-soft group-hover:scale-[1.03]"
                />
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="animate-rise eyebrow">About</p>
            <h1 className="hero-words mt-4 text-[2.5rem] sm:text-[3.4rem]">
              <SplitWords text={`Meet ${site.firstName}`} />
            </h1>
            <Ornament className="mt-6 animate-rise justify-start [animation-delay:300ms]" />
            <p className="mt-8 animate-rise text-lg text-ink-muted [animation-delay:400ms] sm:text-xl">
              {site.owner} offers tarot and astrology readings for questions about love, career, family and
              life, on call or by text.
            </p>
            <div className="mt-10 flex animate-rise flex-wrap gap-4 [animation-delay:500ms]">
              <ButtonLink href="/book">Book a session</ButtonLink>
              <ButtonLink href="/services" variant="outline">
                See readings
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <section aria-label="How sessions work" className="py-12 lg:py-16">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-3">
            {facts.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 90} className="h-full">
                  <div className="h-full rounded-3xl p-7 ring-1 ring-line">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-ivory">
                      <Icon className="size-5 text-gold-700" strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <h2 className="mt-6 text-2xl">{title}</h2>
                    <p className="mt-2 text-ink-muted">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <BookingCta title="Ask the cards." />
    </>
  );
}
