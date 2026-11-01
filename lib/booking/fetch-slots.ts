import { format } from "date-fns";
import { previewSlots, type Slot } from "./preview-slots";

/**
 * Free times from the booking engine (/api/slots). Bookings and holds already
 * taken are left out. Falls back to the preview times when the API can't be
 * reached, such as under `next dev`, which has no Worker.
 */
export async function fetchSlots(service: string, day: Date, signal?: AbortSignal): Promise<Slot[]> {
  const date = format(day, "yyyy-MM-dd");
  try {
    const res = await fetch(`/api/slots?service=${encodeURIComponent(service)}&date=${date}`, { signal });
    const type = res.headers.get("Content-Type") ?? "";
    if (!res.ok || !type.includes("application/json")) throw new Error(String(res.status));
    const data = (await res.json()) as { slots: Slot[] };
    return data.slots;
  } catch (err) {
    if (signal?.aborted) throw err;
    return previewSlots(day);
  }
}
