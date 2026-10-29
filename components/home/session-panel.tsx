import { ArrowRight, MessageCircle, PhoneCall } from "lucide-react";
import { TarotArt } from "@/components/art/tarot-art";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { site } from "@/lib/site";

// Two session cards, one dark and one light, like the reference's card rows,
// with a single quiet line about what to have ready.
export function SessionChoice() {
  return (
    <div>
      <SectionHeading eyebrow="Your session" title="Call or text, your choice" />

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2">
        <Reveal className="h-full">
          <div className="group grain-dark relative h-full overflow-hidden rounded-[32px] bg-night p-8 text-white transition duration-500 ease-soft hover:-translate-y-2 hover:shadow-lift sm:p-10">
            <TarotArt
              icon="moon"
              className="absolute -top-6 -right-6 size-40 text-gold-500/30 transition-transform duration-700 ease-soft group-hover:rotate-[24deg]"
            />
            <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gold-foil shadow-gold">
              <PhoneCall className="size-6 text-ink" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3 className="relative mt-8 text-2xl text-white">Call session</h3>
            <p className="relative mt-2 text-mist">Talk it through with {site.firstName} on a phone call.</p>
          </div>
        </Reveal>
        <Reveal delay={100} className="h-full">
          <div className="group relative h-full overflow-hidden rounded-[32px] bg-white p-8 ring-1 ring-gold-500/60 transition duration-500 ease-soft hover:-translate-y-2 hover:shadow-lift sm:p-10">
            <TarotArt
              icon="eye"
              className="absolute -top-6 -right-6 size-40 text-gold-500/40 transition-transform duration-700 ease-soft group-hover:rotate-[24deg]"
            />
            <span className="relative flex size-14 items-center justify-center rounded-2xl bg-champagne">
              <MessageCircle className="size-6 text-gold-800" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3 className="relative mt-8 text-2xl">Text session</h3>
            <p className="relative mt-2 text-ink-muted">
              Share your question and receive your reading over text.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={150} className="mx-auto mt-5 max-w-4xl">
        <div className="flex flex-col items-start gap-5 rounded-[28px] bg-ivory p-6 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <p className="text-ink">
            <span className="font-bold text-gold-800">Have ready:</span> your name, email, WhatsApp number,
            topic and question. For astrology, also your date, time and place of birth.
          </p>
          <ButtonLink href="/book" className="shrink-0">
            Start booking
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  );
}
