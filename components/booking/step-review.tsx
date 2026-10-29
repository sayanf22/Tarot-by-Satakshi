import { format } from "date-fns";
import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ServiceMeta } from "@/components/services/service-card";
import { Button } from "@/components/ui/button";
import { formatLabels, type Service, type SessionFormat } from "@/lib/types";
import { topicLabel, type BookingDetails } from "@/lib/validation/booking";
import type { StepNumber } from "./step-indicator";

type Props = {
  service: Service;
  sessionFormat: SessionFormat;
  date: Date;
  timeLabel: string;
  details: BookingDetails;
  onEdit: (step: StepNumber) => void;
};

type GroupProps = { title: string; step: StepNumber; onEdit: Props["onEdit"]; children: ReactNode };

function Group({ title, step, onEdit, children }: GroupProps) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-xl text-ink">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs font-semibold tracking-[0.14em] text-gold-800 uppercase hover:underline hover:underline-offset-4"
        >
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium break-words whitespace-pre-line text-ink">{value}</dd>
    </div>
  );
}

export function StepReview({ service, sessionFormat, date, timeLabel, details, onEdit }: Props) {
  const [agreed, setAgreed] = useState(false);
  const needsBirth = service.category === "astrology";
  const birthTime = details.birthTimeUnknown
    ? `Not known${details.birthTimeApprox ? ` (about ${details.birthTimeApprox})` : ""}`
    : details.birthTime;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl text-ink">Review your booking</h2>

      <Group title="Session" step={1} onEdit={onEdit}>
        <Item label="Reading" value={service.name} />
        <Item label="Session" value={formatLabels[sessionFormat]} />
      </Group>

      <Group title="Date and time" step={2} onEdit={onEdit}>
        <Item label="Date" value={format(date, "EEEE, d MMMM yyyy")} />
        <Item label="Time" value={`${timeLabel} IST`} />
      </Group>

      <Group title="Your details" step={3} onEdit={onEdit}>
        <Item label="Name" value={details.name} />
        <Item label="Email" value={details.email} />
        <Item label="WhatsApp" value={details.phone} />
        <Item label="Topic" value={topicLabel(details.topic)} />
        {details.question ? <Item label="Question" value={details.question} wide /> : null}
        {needsBirth ? (
          <>
            <Item
              label="Date of birth"
              value={format(new Date(`${details.birthDate}T00:00`), "d MMMM yyyy")}
            />
            <Item label="Time of birth" value={birthTime} />
            <Item label="Place of birth" value={details.birthPlace} wide />
          </>
        ) : null}
      </Group>

      <div className="rounded-3xl border border-gold-500/50 bg-ivory p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-ink">Amount</span>
          <ServiceMeta service={service} />
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[0.95rem] text-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-gold-700"
          />
          I understand that bookings are non-refundable.
        </label>
        <Button className="mt-6 w-full" disabled aria-describedby="payment-note">
          <Lock className="size-4" aria-hidden="true" />
          Pay and confirm
        </Button>
        <p id="payment-note" className="mt-3 text-center text-sm text-ink-muted">
          Online payment is being set up and will open here soon.
        </p>
      </div>
    </div>
  );
}
