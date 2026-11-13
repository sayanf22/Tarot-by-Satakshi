"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { site } from "@/lib/site";
import type { Service, SessionFormat } from "@/lib/types";
import { useLiveServices } from "@/lib/use-live-services";
import type { BookingDetails } from "@/lib/validation/booking";
import { BookingSummary } from "./booking-summary";
import { StepDetails } from "./step-details";
import { StepIndicator, type StepNumber } from "./step-indicator";
import { StepReview } from "./step-review";
import { StepService } from "./step-service";
import { StepTime } from "./step-time";

/** Said once at the top, so nobody fills in the whole form before finding out they can't pay. */
function PaymentsOffNote() {
  return (
    <output className="mt-6 block rounded-2xl border border-gold-500/50 bg-ivory px-5 py-4 text-sm text-ink">
      <strong>Online payment is being set up.</strong> You can look at readings and free times here. To book
      now, call{" "}
      <a href={site.phone.href} className="font-semibold text-gold-800 underline underline-offset-2">
        {site.phone.display}
      </a>
      .
    </output>
  );
}

export function BookingFlow({ services: built }: { services: readonly Service[] }) {
  const params = useSearchParams();
  // The plans from the build show at once; the live list from the admin replaces them.
  const { services } = useLiveServices(built);
  // Unknown until the Worker answers; then true or false.
  const [paymentsOn, setPaymentsOn] = useState<boolean | null>(null);
  useEffect(() => {
    void api<{ payments: boolean }>("/api/config").then((r) => setPaymentsOn(r.ok && r.data.payments));
  }, []);
  const wanted = params.get("service");
  const preselected = services.find((s) => s.slug === wanted);

  const [step, setStep] = useState<StepNumber>(1);
  const [serviceSlug, setServiceSlug] = useState(preselected?.slug);
  const [sessionFormat, setSessionFormat] = useState<SessionFormat | undefined>(
    preselected?.formats.length === 1 ? preselected.formats[0] : undefined,
  );
  // A link to a plan added after the last build: pick it once the live list arrives.
  const [linkUsed, setLinkUsed] = useState(Boolean(preselected));
  if (!linkUsed && preselected && !serviceSlug) {
    setLinkUsed(true);
    setServiceSlug(preselected.slug);
    if (preselected.formats.length === 1) setSessionFormat(preselected.formats[0]);
  }
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [timeLabel, setTimeLabel] = useState<string>();
  const [details, setDetails] = useState<BookingDetails>();
  // Bumped to make the times list load again (after a time was taken by someone else).
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [takenNotice, setTakenNotice] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const service = services.find((s) => s.slug === serviceSlug);

  function goTo(next: StepNumber) {
    setStep(next);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  function chooseService(slug: string) {
    // Free times depend on the reading's length, so a new reading clears the time.
    if (slug !== serviceSlug) {
      setTime(undefined);
      setTimeLabel(undefined);
    }
    setServiceSlug(slug);
    const chosen = services.find((s) => s.slug === slug);
    // Keep the format if the new reading offers it.
    setSessionFormat((current) =>
      chosen && current && chosen.formats.includes(current)
        ? current
        : chosen?.formats.length === 1
          ? chosen.formats[0]
          : undefined,
    );
    // Birth details only apply to astrology, so a category change starts the form again.
    if (service && chosen && service.category !== chosen.category) setDetails(undefined);
  }

  function chooseDate(next: Date | undefined) {
    setDate(next);
    setTime(undefined);
    setTimeLabel(undefined);
  }

  const stepTitles: Record<StepNumber, string> = {
    1: "Step 1 of 4: choose a reading",
    2: "Step 2 of 4: choose a date and time",
    3: "Step 3 of 4: your details",
    4: "Step 4 of 4: review",
  };

  return (
    <div ref={topRef} className="scroll-mt-28">
      <StepIndicator current={step} onSelect={goTo} />
      {paymentsOn === false ? <PaymentsOffNote /> : null}
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {stepTitles[step]}
      </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
        <div className="min-w-0">
          {step === 1 ? (
            <StepService
              services={services}
              serviceSlug={serviceSlug}
              sessionFormat={sessionFormat}
              onService={chooseService}
              onFormat={setSessionFormat}
              onNext={() => goTo(2)}
            />
          ) : null}

          {step === 2 && serviceSlug ? (
            <StepTime
              serviceSlug={serviceSlug}
              date={date}
              time={time}
              refreshKey={slotsVersion}
              notice={takenNotice}
              onDate={chooseDate}
              onTime={(value, label) => {
                setTime(value);
                setTimeLabel(label);
                setTakenNotice(null);
              }}
              onTimeGone={() => {
                // The chosen time was booked by someone else while this page was open.
                setTakenNotice(
                  `${timeLabel ?? "The time you chose"} has just been booked by someone else. Please choose another time.`,
                );
                setTime(undefined);
                setTimeLabel(undefined);
              }}
              onBack={() => goTo(1)}
              onNext={() => goTo(3)}
              durationMin={service?.durationMin}
            />
          ) : null}

          {step === 3 && service ? (
            <StepDetails
              key={service.category}
              needsBirthDetails={service.birthDetails}
              initial={details}
              onBack={() => goTo(2)}
              onSubmit={(values) => {
                setDetails(values);
                goTo(4);
              }}
            />
          ) : null}

          {step === 4 && service && sessionFormat && date && time && timeLabel && details ? (
            <StepReview
              service={service}
              sessionFormat={sessionFormat}
              date={date}
              time={time}
              timeLabel={timeLabel}
              paymentsOn={paymentsOn === true}
              details={details}
              onEdit={goTo}
              onTimeTaken={() => {
                // Someone else took the time: back to the times, which now show it as booked.
                setTakenNotice(
                  `Sorry, ${timeLabel} was just booked by someone else. Please choose another time. Your details are kept.`,
                );
                setTime(undefined);
                setTimeLabel(undefined);
                setSlotsVersion((v) => v + 1);
                goTo(2);
              }}
            />
          ) : null}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <BookingSummary service={service} sessionFormat={sessionFormat} date={date} timeLabel={timeLabel} />
        </div>
      </div>
    </div>
  );
}
