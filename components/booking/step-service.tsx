import { MessageCircle, PhoneCall } from "lucide-react";
import { TarotArt } from "@/components/art/tarot-art";
import { ReadingsSoon } from "@/components/sections/readings-soon";
import { SampleTag } from "@/components/services/service-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/format";
import { categoryLabels, type Service, type SessionFormat } from "@/lib/types";

const formatOptions: Record<SessionFormat, { title: string; text: string; icon: typeof PhoneCall }> = {
  call: { title: "Call", text: "A phone call with Satakshi.", icon: PhoneCall },
  text: { title: "Text", text: "A session over text.", icon: MessageCircle },
};

export const optionClasses =
  "relative flex cursor-pointer rounded-2xl border bg-white transition-colors duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-700";

export function optionState(selected: boolean) {
  return selected ? "border-gold-600 bg-ivory ring-1 ring-gold-600" : "border-line hover:border-gold-500";
}

type Props = {
  services: readonly Service[];
  serviceSlug?: string;
  sessionFormat?: SessionFormat;
  onService: (slug: string) => void;
  onFormat: (format: SessionFormat) => void;
  onNext: () => void;
};

export function StepService({ services, serviceSlug, sessionFormat, onService, onFormat, onNext }: Props) {
  const service = services.find((s) => s.slug === serviceSlug);
  const ready = Boolean(service && sessionFormat && service.formats.includes(sessionFormat));

  if (services.length === 0) return <ReadingsSoon />;

  return (
    <div className="space-y-12">
      <fieldset>
        <legend className="font-display text-2xl text-ink">Choose a reading</legend>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const selected = s.slug === serviceSlug;
            return (
              <label
                key={s.slug}
                className={cn(optionClasses, optionState(selected), "items-start gap-4 p-4")}
              >
                <input
                  type="radio"
                  name="service"
                  value={s.slug}
                  checked={selected}
                  onChange={() => onService(s.slug)}
                  className="sr-only"
                />
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ivory ring-1 ring-gold-500/25">
                  <TarotArt icon={s.icon} className="size-10 text-gold-700" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg leading-snug text-ink">{s.name}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">
                    {categoryLabels[s.category]} · {s.summary}
                  </span>
                  <span className="mt-2 block text-sm">
                    {s.durationMin || s.pricePaise ? (
                      <span className="font-semibold text-ink tabular">
                        {[
                          s.durationMin && formatDuration(s.durationMin),
                          s.pricePaise && formatPrice(s.pricePaise),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : s.sample ? (
                      <SampleTag />
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {service ? (
        <fieldset>
          <legend className="font-display text-2xl text-ink">How would you like your session?</legend>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {service.formats.map((f) => {
              const option = formatOptions[f];
              const Icon = option.icon;
              const selected = f === sessionFormat;
              return (
                <label key={f} className={cn(optionClasses, optionState(selected), "items-center gap-4 p-5")}>
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={selected}
                    onChange={() => onFormat(f)}
                    className="sr-only"
                  />
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold-500 bg-white">
                    <Icon className="size-5 text-gold-700" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{option.title}</span>
                    <span className="block text-sm text-ink-muted">{option.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex justify-end border-t border-line pt-8">
        <Button onClick={onNext} disabled={!ready}>
          Continue
        </Button>
      </div>
    </div>
  );
}
