import { ArrowRight } from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { Particles } from "@/components/art/particles";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { site } from "@/lib/site";

export function BookingCta({ title = "Ready when you are." }: { title?: string }) {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <Reveal className="relative overflow-hidden rounded-[40px] bg-ivory px-6 py-16 text-center ring-1 ring-line sm:px-12 lg:py-20">
          <Particles count={16} seed={21} />
          <Mandala className="spin-slow pointer-events-none absolute top-1/2 left-1/2 w-[30rem] max-w-[120%] -translate-1/2 text-gold-500/35" />
          <div className="relative">
            <h2 className="text-[2rem] sm:text-5xl">
              <SplitWords text={title} />
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-muted">
              Sessions run {site.hours.days}, {site.hours.time} {site.hours.timeZone}.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/book">
                Book a session
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline">
                Ask a question
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
