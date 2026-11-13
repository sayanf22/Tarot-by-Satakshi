"use client";

import { ArrowRight, MessageCircle, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { api } from "@/lib/api";
import { SessionLength } from "@/components/services/service-card";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { sessionLabel, type Service } from "@/lib/types";

type Priced = Service & { pricePaise: number };

function withPrice(list: readonly Service[]) {
  return list.filter((s): s is Priced => typeof s.pricePaise === "number" && s.pricePaise > 0);
}

/** The whole photo, never cropped: it sits inside the frame, over a blurred copy of itself. */
function PlanPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px] bg-ivory ring-1 ring-line @xl:w-56">
      {/* oxlint-disable-next-line nextjs/no-img-element -- static export: photos are compressed on upload */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-xl"
      />
      {/* oxlint-disable-next-line nextjs/no-img-element -- static export: photos are compressed on upload */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="relative size-full object-contain"
      />
    </div>
  );
}

/**
 * One plan on the Pricing page. It lays itself out by its own width (container queries), so the
 * admin preview shows exactly this row at phone width and the page shows it wider.
 */
export function PricingRow({ s }: { s: Service & { pricePaise: number } }) {
  return (
    <li className="@container border-b border-line last:border-b-0">
      <div className="flex flex-col gap-6 p-6 @xl:flex-row @xl:items-center @xl:p-8">
        {s.image ? <PlanPhoto src={s.image} alt={s.name} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-6 @4xl:flex-row @4xl:items-center @4xl:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{s.categoryName}</p>
            <h2 className="mt-2 text-2xl">{s.name}</h2>
            {s.summary ? <p className="mt-2 text-ink">{s.summary}</p> : null}
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
              {s.durationMin ? <SessionLength minutes={s.durationMin} /> : null}
              {s.durationMin ? <span aria-hidden="true">·</span> : null}
              {sessionLabel(s.formats).replace(/ session$/, "")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 @4xl:shrink-0 @4xl:flex-col @4xl:items-end">
            <p className="font-display text-3xl text-ink tabular">
              {s.pricePaise > 0 ? formatPrice(s.pricePaise) : "₹ —"}
            </p>
            <ButtonLink href={`/book?service=${s.slug}`} variant="outline">
              Book this reading
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </li>
  );
}

// Prices shown when the page was built appear at once; the live list from the admin
// replaces them, so a price changed in the admin shows here without a rebuild.
export function PricingList({ built }: { built: readonly Service[] }) {
  const [plans, setPlans] = useState(() => withPrice(built));
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void api<{ services: Service[] }>("/api/services").then((r) => {
      if (r.ok) setPlans(withPrice(r.data.services));
      setChecked(true);
    });
  }, []);

  if (plans.length === 0) {
    // Until the live list arrives, an empty build shows nothing rather than a notice that may vanish.
    if (!checked && built.length > 0) return null;
    return (
      <div className="rounded-[32px] bg-ivory px-6 py-12 text-center ring-1 ring-line sm:px-10">
        <h2 className="text-3xl">Prices are being added</h2>
        <p className="mx-auto mt-4 max-w-md text-ink">
          Online prices will appear here once they are set. To ask about a reading now, call or send a message
          to {site.firstName}.
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
    );
  }

  return (
    <ul className="overflow-hidden rounded-[32px] bg-white ring-1 ring-line">
      {plans.map((s) => (
        <PricingRow key={s.slug} s={s} />
      ))}
    </ul>
  );
}
