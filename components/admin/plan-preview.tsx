"use client";

import { useState } from "react";
import { ReadingCard } from "@/components/cards/reading-card";
import { ServiceChoice } from "@/components/booking/step-service";
import { PricingRow } from "@/components/pricing/pricing-list";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

type Draft = Service & { pricePaise: number };

const views = [
  { id: "card", label: "Home card" },
  { id: "pricing", label: "Pricing page" },
  { id: "booking", label: "Booking page" },
] as const;
type View = (typeof views)[number]["id"];

const noop = () => {};

/**
 * Shows the plan as visitors will see it, using the same components as the live site.
 * Nothing in here can be clicked: it is a picture of the plan, updated as the form changes.
 */
export function PlanPreview({ draft }: { draft: Draft }) {
  const [view, setView] = useState<View>("card");
  const [back, setBack] = useState(false);

  return (
    <div className="rounded-[24px] bg-ivory p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Live preview</p>
        <p className="text-xs text-ink-muted">Updates as you type</p>
      </div>

      <div
        role="tablist"
        aria-label="Where to preview"
        className="mt-3 flex gap-1 rounded-full bg-white p-1 ring-1 ring-line"
      >
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`pv-tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls="pv-panel"
            onClick={() => setView(v.id)}
            className={cn(
              "min-w-0 flex-1 rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:text-[0.8rem]",
              view === v.id ? "bg-gold-foil text-ink shadow-gold" : "text-ink-muted hover:text-ink",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div id="pv-panel" role="tabpanel" aria-labelledby={`pv-tab-${view}`} className="mt-4">
        {view === "card" ? (
          <div>
            <div className="mx-auto w-[15rem] max-w-full" inert>
              <ReadingCard
                service={draft}
                flipped={back}
                turned={false}
                onTurn={noop}
                onTurnBack={noop}
                interactive={false}
              />
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {[false, true].map((isBack) => (
                <button
                  key={String(isBack)}
                  type="button"
                  aria-pressed={back === isBack}
                  onClick={() => setBack(isBack)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                    back === isBack
                      ? "border-gold-600 bg-white text-ink ring-1 ring-gold-600"
                      : "border-line bg-white text-ink-muted hover:border-gold-500",
                  )}
                >
                  {isBack ? "Back (details)" : "Front"}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-muted">
              Visitors see the front first. The back shows when they hover or tap.
            </p>
          </div>
        ) : null}

        {view === "pricing" ? (
          <ul inert className="overflow-hidden rounded-[24px] bg-white ring-1 ring-line">
            <PricingRow s={draft} />
          </ul>
        ) : null}

        {view === "booking" ? (
          <div inert className="grid gap-3">
            <ServiceChoice s={draft} selected onSelect={noop} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
