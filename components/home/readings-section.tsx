"use client";

import { ArrowRight } from "lucide-react";
import { ReadingsDeck } from "@/components/home/readings-deck";
import { ReadingsSoon } from "@/components/sections/readings-soon";
import { ButtonLink } from "@/components/ui/button";
import { useLiveServices } from "@/lib/use-live-services";
import type { Service } from "@/lib/types";

/** The home page deck, with the plans saved in the admin (live, not only those from the build). */
export function ReadingsSection({ built, homeCards }: { built: readonly Service[]; homeCards: number }) {
  const live = useLiveServices(built, homeCards);
  const { services } = live;
  const shown = Math.min(12, Math.max(3, live.homeCards));

  // An empty build waits for the live list rather than flashing "being added".
  if (services.length === 0) return live.checked ? <ReadingsSoon /> : null;

  return (
    <>
      {/* A new key when the list changes, so the deck starts again on the first card. */}
      <ReadingsDeck key={services.map((s) => s.slug).join("|")} services={services.slice(0, shown)} />
      {services.length > shown ? (
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/services" variant="outline">
            See all {services.length} readings
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}
