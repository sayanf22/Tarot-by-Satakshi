"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { Service, SessionFormat } from "@/lib/types";
import type { BookingDetails } from "@/lib/validation/booking";
import { BookingSummary } from "./booking-summary";
import { StepDetails } from "./step-details";
import { StepIndicator, type StepNumber } from "./step-indicator";
import { StepReview } from "./step-review";
import { StepService } from "./step-service";
import { StepTime } from "./step-time";

export function BookingFlow({ services }: { services: readonly Service[] }) {
  const params = useSearchParams();
  const preselected = services.find((s) => s.slug === params.get("service"));

  const [step, setStep] = useState<StepNumber>(1);
  const [serviceSlug, setServiceSlug] = useState(preselected?.slug);
  const [sessionFormat, setSessionFormat] = useState<SessionFormat | undefined>(
    preselected?.formats.length === 1 ? preselected.formats[0] : undefined,
  );
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [timeLabel, setTimeLabel] = useState<string>();
  const [details, setDetails] = useState<BookingDetails>();
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
              onDate={chooseDate}
              onTime={(value, label) => {
                setTime(value);
                setTimeLabel(label);
              }}
              onBack={() => goTo(1)}
              onNext={() => goTo(3)}
            />
          ) : null}

          {step === 3 && service ? (
            <StepDetails
              key={service.category}
              needsBirthDetails={service.category === "astrology"}
              initial={details}
              onBack={() => goTo(2)}
              onSubmit={(values) => {
                setDetails(values);
                goTo(4);
              }}
            />
          ) : null}

          {step === 4 && service && sessionFormat && date && timeLabel && details ? (
            <StepReview
              service={service}
              sessionFormat={sessionFormat}
              date={date}
              timeLabel={timeLabel}
              details={details}
              onEdit={goTo}
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
