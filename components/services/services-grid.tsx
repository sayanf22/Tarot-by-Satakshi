"use client";

import { TurnableReadingCard } from "@/components/cards/reading-card";
import { Reveal } from "@/components/motion/reveal";
import { ReadingsSoon } from "@/components/sections/readings-soon";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
import { useLiveServices } from "@/lib/use-live-services";
import type { Service } from "@/lib/types";

/**
 * Every live plan, grouped by category in the order the client set. A category with no live plan
 * is not shown. Loads the plans and categories saved in the admin right now.
 */
export function ServicesGrid({ built }: { built: readonly Service[] }) {
  const { services, categories, checked } = useLiveServices(built);
  const groups = categories
    .map((c) => ({ ...c, items: services.filter((s) => s.category === c.slug) }))
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
        <section key={group.slug} aria-label={group.name} className="mb-24 last:mb-0">
          <Container>
            <RuleTitle title={group.name} />
            {group.description ? (
              <p className="mx-auto mt-4 max-w-xl text-center text-ink-muted">{group.description}</p>
            ) : null}
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
