"use client";

import { TurnableReadingCard } from "@/components/cards/reading-card";
import { Reveal } from "@/components/motion/reveal";
import { ReadingsSoon } from "@/components/sections/readings-soon";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
import { useLiveServices } from "@/lib/use-live-services";
import { categoryLabels, type Service, type ServiceCategory } from "@/lib/types";

const order: ServiceCategory[] = ["tarot", "astrology"];

/** Every live plan, grouped by type. Loads the plans saved in the admin right now. */
export function ServicesGrid({ built }: { built: readonly Service[] }) {
  const { services, checked } = useLiveServices(built);
  const groups = order
    .map((category) => ({ category, items: services.filter((s) => s.category === category) }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0)
    return checked ? (
      <Container>
        <ReadingsSoon />
      </Container>
    ) : null;

  return (
    <>
      {groups.map((group) => (
        <section key={group.category} aria-label={categoryLabels[group.category]} className="mb-24 last:mb-0">
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
    </>
  );
}
