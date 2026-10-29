import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay } from "date-fns";

// PREVIEW ONLY. Real free slots come from the Worker's booking engine (phase 5),
// using each service's duration, buffers, existing bookings and holds.
// This mirrors Satakshi's confirmed hours: Monday to Saturday, 11 am to 9 pm IST.

export const TIME_ZONE = "Asia/Kolkata";
const OPEN_HOUR = 11;
const CLOSE_HOUR = 21;
const SLOT_MINUTES = 60; // Sample length until durations are confirmed.
const MIN_NOTICE_MS = 60 * 60 * 1000; // Sample: one hour.
export const BOOKING_WINDOW_DAYS = 30; // Sample.

export type Slot = { value: string; label: string };

function label(hour: number) {
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:00 ${suffix}`;
}

export function bookingWindow(now = new Date()) {
  const first = startOfDay(now);
  return { first, last: addDays(first, BOOKING_WINDOW_DAYS) };
}

export function isClosedDay(day: Date) {
  return day.getDay() === 0; // Sunday
}

export function previewSlots(day: Date, now = new Date()): Slot[] {
  if (isClosedDay(day)) return [];
  const slots: Slot[] = [];
  for (let hour = OPEN_HOUR; hour + SLOT_MINUTES / 60 <= CLOSE_HOUR; hour++) {
    const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, TIME_ZONE);
    if (start.getTime() < now.getTime() + MIN_NOTICE_MS) continue;
    slots.push({ value: `${String(hour).padStart(2, "0")}:00`, label: label(hour) });
  }
  return slots;
}
