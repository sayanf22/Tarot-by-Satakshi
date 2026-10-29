import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { bookingWindow, isClosedDay, previewSlots } from "@/lib/booking/preview-slots";
import { optionClasses, optionState } from "./step-service";

type Props = {
  date?: Date;
  time?: string;
  onDate: (date: Date | undefined) => void;
  onTime: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
};

// Sundays, and today once its last slot has passed, can't be picked.
function hasNoSlots(day: Date) {
  return isClosedDay(day) || previewSlots(day).length === 0;
}

export function StepTime({ date, time, onDate, onTime, onBack, onNext }: Props) {
  const { first, last } = bookingWindow();
  const slots = date ? previewSlots(date) : [];

  return (
    <div className="space-y-10">
      <div className="grid gap-10 xl:grid-cols-[auto_1fr]">
        <div>
          <h2 className="font-display text-2xl text-ink">Choose a date</h2>
          <p className="mt-1 text-sm text-ink-muted">Sessions run Monday to Saturday.</p>
          <div className="mt-5 inline-block rounded-3xl border border-line bg-white p-3 sm:p-5">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={onDate}
              weekStartsOn={1}
              startMonth={first}
              endMonth={last}
              disabled={[{ before: first }, { after: last }, hasNoSlots]}
            />
          </div>
        </div>

        <fieldset aria-describedby="slots-note">
          <legend className="font-display text-2xl text-ink">
            {date ? `Times on ${format(date, "EEE, d MMM")}` : "Choose a time"}
          </legend>
          <p id="slots-note" className="mt-1 text-sm text-ink-muted">
            All times are in IST (India).
          </p>
          {!date ? (
            <p className="mt-6 rounded-3xl border border-dashed border-gold-500/70 bg-ivory px-5 py-8 text-center text-ink-muted">
              Pick a date to see the free times.
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-6 rounded-3xl border border-dashed border-gold-500/70 bg-ivory px-5 py-8 text-center text-ink-muted">
              No free times on this day. Please choose another date.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((slot) => {
                const selected = slot.value === time;
                return (
                  <label
                    key={slot.value}
                    className={cn(optionClasses, optionState(selected), "justify-center px-3 py-3.5")}
                  >
                    <input
                      type="radio"
                      name="time"
                      value={slot.value}
                      checked={selected}
                      onChange={() => onTime(slot.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "text-[0.95rem] font-semibold tabular",
                        selected ? "text-gold-800" : "text-ink",
                      )}
                    >
                      {slot.label}
                    </span>
                  </label>
                );
              })}
            </div>
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
