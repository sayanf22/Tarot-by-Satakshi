import { format } from "date-fns";
import { Clock, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { SessionLength } from "@/components/services/service-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { fetchDays, fetchSlots, type DayStatus, type TimeSlot } from "@/lib/booking/fetch-slots";
import { bookingWindow, isClosedDay, previewSlots } from "@/lib/booking/preview-slots";
import { optionClasses, optionState } from "./step-service";

type Props = {
  serviceSlug: string;
  durationMin?: number;
  date?: Date;
  time?: string;
  /** Changes when the times must be loaded again (another client took the chosen one). */
  refreshKey?: number;
  /** Shown above the times, e.g. "that time was just booked". */
  notice?: string | null;
  onDate: (date: Date | undefined) => void;
  onTime: (time: string, label: string) => void;
  /** The chosen time was booked by someone else while this page was open. */
  onTimeGone: () => void;
  onBack: () => void;
  onNext: () => void;
};

/** How often the times are checked again while the page is open, so taken times turn grey. */
const REFRESH_MS = 30_000;

type Loaded = { key: string; slots: TimeSlot[] } | { key: string; error: true };

export function StepTime({
  serviceSlug,
  durationMin,
  date,
  time,
  refreshKey = 0,
  notice,
  onDate,
  onTime,
  onTimeGone,
  onBack,
  onNext,
}: Props) {
  const { first, last } = bookingWindow();
  const key = date ? `${serviceSlug}:${format(date, "yyyy-MM-dd")}` : "";
  const [loaded, setLoaded] = useState<Loaded>();
  const [tick, setTick] = useState(0);
  const [days, setDays] = useState<Map<string, DayStatus> | null>(null);
  const current = loaded?.key === key ? loaded : undefined;
  const slots = current && "slots" in current ? current.slots : [];
  const failed = Boolean(current && "error" in current);
  const loading = Boolean(date) && !current;

  // Keep the latest choice and handler without restarting the loading effects.
  const latest = useRef({ time, onTimeGone });
  useEffect(() => {
    latest.current = { time, onTimeGone };
  });

  // Which dates are open, full or closed (the admin's hours and days off).
  // refreshKey and tick only ask for a fresh copy.
  useEffect(() => {
    const controller = new AbortController();
    fetchDays(serviceSlug, controller.signal)
      .then(setDays)
      .catch(() => {});
    return () => controller.abort();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- reload triggers
  }, [serviceSlug, refreshKey, tick]);

  // The times for the chosen date. Loaded again every 30 seconds and when the visitor comes
  // back to the tab, so a time someone else books turns grey here.
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    fetchSlots(serviceSlug, date, controller.signal)
      .then((list) => {
        setLoaded({ key, slots: list });
        const chosen = latest.current.time;
        if (chosen && list.find((s) => s.value === chosen)?.status !== "free") latest.current.onTimeGone();
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded((prev) => (prev?.key === key ? prev : { key, error: true }));
      });
    return () => controller.abort();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- reload triggers
  }, [serviceSlug, date, key, refreshKey, tick]);

  useEffect(() => {
    const again = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    const timer = setInterval(again, REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, []);

  const statusOf = (day: Date) => days?.get(format(day, "yyyy-MM-dd"));
  // Before the dates load, the usual week (Monday to Saturday) stands in.
  const noTimes = (day: Date) =>
    days ? statusOf(day) !== "open" : isClosedDay(day) || previewSlots(day).length === 0;
  const isFull = (day: Date) => statusOf(day) === "full";
  const freeCount = slots.filter((s) => s.status === "free").length;

  return (
    <div className="space-y-10">
      <div className="grid gap-10 xl:grid-cols-[auto_1fr]">
        <div>
          <h2 className="font-display text-2xl text-ink">Choose a date</h2>
          <p className="mt-1 text-sm text-ink-muted">Days with free times are filled in gold.</p>
          <div className="mt-5 inline-block rounded-3xl border border-line bg-white p-3 sm:p-5">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={onDate}
              weekStartsOn={1}
              startMonth={first}
              endMonth={last}
              disabled={[{ before: first }, { after: last }, noTimes]}
              modifiers={{ full: isFull }}
              modifiersClassNames={{ full: "is-full" }}
            />
          </div>
          <ul
            className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted"
            aria-label="Calendar key"
          >
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-ivory ring-1 ring-gold-500" aria-hidden="true" /> Free
              times
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#ece8e1] line-through" aria-hidden="true" /> Fully
              booked
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-full ring-1 ring-line" aria-hidden="true" /> Closed
            </li>
          </ul>
        </div>

        <fieldset aria-describedby="slots-note">
          <legend className="font-display text-2xl text-ink">
            {date ? `Times on ${format(date, "EEE, d MMM")}` : "Choose a time"}
          </legend>
          <p id="slots-note" className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <Clock className="size-4 text-gold-700" aria-hidden="true" />
            All times are in IST (India).
            {durationMin ? (
              <span>
                Each start time is for a{" "}
                <SessionLength minutes={durationMin} className="font-semibold text-ink" />.
              </span>
            ) : null}
          </p>

          {notice ? (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger"
            >
              {notice}
            </p>
          ) : null}

          {!date ? (
            <p className="mt-6 rounded-3xl border border-dashed border-gold-500/70 bg-ivory px-5 py-8 text-center text-ink-muted">
              Pick a date to see the free times.
            </p>
          ) : loading ? (
            <output className="mt-6 block rounded-3xl border border-dashed border-gold-500/70 bg-ivory px-5 py-8 text-center text-ink-muted">
              Checking free times…
            </output>
          ) : failed ? (
            <div className="mt-6 rounded-3xl border border-danger/30 bg-white px-5 py-8 text-center">
              <p role="alert" className="text-danger">
                The times couldn&apos;t be loaded. Please check your connection.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setTick((t) => t + 1)}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </Button>
            </div>
          ) : slots.length === 0 ? (
            <p className="mt-6 rounded-3xl border border-dashed border-gold-500/70 bg-ivory px-5 py-8 text-center text-ink-muted">
              No times on this day. Please choose another date.
            </p>
          ) : (
            <>
              {freeCount === 0 ? (
                <p className="mt-6 rounded-2xl bg-ivory px-4 py-3 text-sm text-ink">
                  Every time on this day is booked. Please choose another date.
                </p>
              ) : null}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const booked = slot.status === "booked";
                  const selected = !booked && slot.value === time;
                  return (
                    <label
                      key={slot.value}
                      className={cn(
                        optionClasses,
                        "flex-col items-center justify-center px-3 py-3",
                        booked
                          ? "cursor-not-allowed border-dashed border-line bg-[#f3f0ea] text-ink-muted"
                          : optionState(selected),
                      )}
                    >
                      <input
                        type="radio"
                        name="time"
                        value={slot.value}
                        checked={selected}
                        disabled={booked}
                        onChange={() => onTime(slot.value, slot.label)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "text-[0.95rem] font-semibold tabular",
                          booked ? "text-ink-muted line-through" : selected ? "text-gold-800" : "text-ink",
                        )}
                      >
                        {slot.label}
                      </span>
                      <span className={cn("text-[0.7rem] font-semibold", booked ? "" : "sr-only")}>
                        {booked ? "Booked" : "Free"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-ink-muted">
                Grey times are already booked or being paid for by someone else. This list updates on its own.
              </p>
            </>
          )}
        </fieldset>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!date || !time}>
          Continue
        </Button>
      </div>
    </div>
  );
}
