import { format } from "date-fns";
import { TarotArt } from "@/components/art/tarot-art";
import { ServiceMeta } from "@/components/services/service-card";
import { Ornament } from "@/components/ui/ornament";
import { formatLabels, type Service, type SessionFormat } from "@/lib/types";

type Props = {
  service?: Service;
  sessionFormat?: SessionFormat;
  date?: Date;
  timeLabel?: string;
};

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-[0.95rem] font-semibold text-ink">{value ?? "–"}</dd>
    </div>
  );
}

export function BookingSummary({ service, sessionFormat, date, timeLabel }: Props) {
  return (
    <aside aria-label="Your booking" className="rounded-[28px] bg-white p-2 shadow-soft ring-1 ring-line">
      <div className="rounded-[22px] bg-linear-to-b from-ivory to-white px-6 py-7">
        <div className="flex items-center gap-4">
          <TarotArt icon={service?.icon ?? "star"} className="size-12 shrink-0 text-gold-700" />
          <div>
            <p className="eyebrow">Your booking</p>
            <p className="mt-1 font-display text-xl text-ink">{service?.name ?? "Choose a reading"}</p>
          </div>
        </div>
        <Ornament className="mt-6" width="w-16" />
        <dl className="mt-3 divide-y divide-line">
          <Row label="Session" value={sessionFormat ? formatLabels[sessionFormat] : undefined} />
          <Row label="Date" value={date ? format(date, "EEE, d MMM yyyy") : undefined} />
          <Row label="Time" value={timeLabel ? `${timeLabel} IST` : undefined} />
        </dl>
        {service ? (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-muted">Price</span>
            <ServiceMeta service={service} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
