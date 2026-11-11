import { format } from "date-fns";
import { previewSlots } from "./preview-slots";

export type SlotStatus = "free" | "booked";
export type TimeSlot = { value: string; label: string; status: SlotStatus };
export type DayStatus = "open" | "full" | "closed";

// Under `next dev` there is no Worker, so the preview times stand in. On the real site a
// failed request shows an error with a "Try again" button instead: never made-up times.
const DEV = process.env.NODE_ENV === "development";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const type = res.headers.get("Content-Type") ?? "";
  if (!res.ok || !type.includes("application/json")) throw new Error(String(res.status));
  return (await res.json()) as T;
}

/** Every start time on a day from the booking engine (/api/slots), each free or booked. */
export async function fetchSlots(service: string, day: Date, signal?: AbortSignal): Promise<TimeSlot[]> {
  const date = format(day, "yyyy-MM-dd");
  try {
    const data = await getJson<{ slots: TimeSlot[] }>(
      `/api/slots?service=${encodeURIComponent(service)}&date=${date}`,
      signal,
    );
    return data.slots.map((s) => ({ ...s, status: s.status === "booked" ? "booked" : "free" }));
  } catch (err) {
    if (signal?.aborted || !DEV) throw err;
    return previewSlots(day).map((s) => ({ ...s, status: "free" }));
  }
}

/** Each date in the booking window as open, full or closed (/api/days). */
export async function fetchDays(service: string, signal?: AbortSignal): Promise<Map<string, DayStatus>> {
  const data = await getJson<{ days: { date: string; status: DayStatus }[] }>(
    `/api/days?service=${encodeURIComponent(service)}`,
    signal,
  );
  return new Map(data.days.map((d) => [d.date, d.status]));
}
