import { addDaysIso, hhmm, istToday, istToUtc, MINUTE, timeLabel, weekdayOf } from "./time";

export type ServiceRow = {
  id: number;
  slug: string;
  name: string;
  category: "tarot" | "astrology";
  summary: string;
  icon: string;
  card: string;
  formats: string;
  duration_min: number | null;
  price_paise: number | null;
  is_sample: number;
  active: number;
  sort_order: number;
  image_key: string | null;
  archived: number;
};

/** A plan can be booked online only once it has a real price and length. */
export function bookable(s: ServiceRow) {
  return s.price_paise != null && s.price_paise >= 100 && s.duration_min != null && s.is_sample === 0;
}

/** Public shape of a service (matches lib/types.ts `Service`). */
export function publicService(s: ServiceRow) {
  return {
    slug: s.slug,
    name: s.name,
    category: s.category,
    summary: s.summary,
    icon: s.icon,
    card: s.card,
    formats: s.formats.split(",").filter((f) => f === "call" || f === "text"),
    durationMin: s.duration_min ?? undefined,
    pricePaise: s.price_paise ?? undefined,
    sample: s.is_sample === 1 || undefined,
    image: s.image_key ? `/media/${s.image_key}` : undefined,
    bookable: bookable(s),
  };
}

export async function activeServices(db: D1Database) {
  const { results } = await db
    .prepare("SELECT * FROM services WHERE active = 1 AND archived = 0 ORDER BY sort_order, id")
    .all<ServiceRow>();
  return results;
}

export async function serviceBySlug(db: D1Database, slug: string) {
  return db
    .prepare("SELECT * FROM services WHERE slug = ?1 AND active = 1 AND archived = 0")
    .bind(slug)
    .first<ServiceRow>();
}

export type BookingSettings = {
  slotMinutes: number;
  minNoticeMinutes: number;
  windowDays: number;
  holdMinutes: number;
};

export async function bookingSettings(db: D1Database): Promise<BookingSettings> {
  const { results } = await db
    .prepare("SELECT key, value FROM settings")
    .all<{ key: string; value: string }>();
  const map = new Map(results.map((r) => [r.key, Number(r.value)]));
  const pick = (k: string, fallback: number) => {
    const v = map.get(k);
    return v && Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    slotMinutes: pick("slot_minutes", 60),
    minNoticeMinutes: pick("min_notice_minutes", 60),
    windowDays: pick("window_days", 30),
    holdMinutes: pick("hold_minutes", 15),
  };
}

/** Bookings are stored in 15-minute blocks; a slot is free when none of its blocks is taken. */
export const UNIT_MS = 15 * MINUTE;

export function unitsFor(startAt: number, durationMin: number) {
  const units: number[] = [];
  for (let t = startAt; t < startAt + durationMin * MINUTE; t += UNIT_MS) units.push(t);
  return units;
}

export type Slot = { value: string; label: string; startAt: number };

/**
 * Free start times on one IST date for a session of `durationMin`.
 * Uses the weekly hours, any override for that date, the minimum notice, and the
 * blocks held by confirmed bookings or unexpired holds.
 */
export async function freeSlots(db: D1Database, date: string, durationMin: number, now = Date.now()) {
  const settings = await bookingSettings(db);
  const today = istToday(now);
  if (date < today || date > addDaysIso(today, settings.windowDays)) return [];

  const [rule, override] = await Promise.all([
    db
      .prepare("SELECT enabled, open_min, close_min FROM availability_rules WHERE weekday = ?1")
      .bind(weekdayOf(date))
      .first<{ enabled: number; open_min: number; close_min: number }>(),
    db
      .prepare("SELECT closed, open_min, close_min FROM availability_overrides WHERE date = ?1")
      .bind(date)
      .first<{ closed: number; open_min: number | null; close_min: number | null }>(),
  ]);

  let open: number | null = rule?.enabled ? rule.open_min : null;
  let close: number | null = rule?.enabled ? rule.close_min : null;
  if (override) {
    if (override.closed) return [];
    if (override.open_min != null && override.close_min != null) {
      open = override.open_min;
      close = override.close_min;
    }
  }
  if (open == null || close == null || close <= open) return [];

  const dayStart = istToUtc(date, open);
  const dayEnd = istToUtc(date, close);
  const { results } = await db
    .prepare(
      `SELECT u.unit_start FROM booking_slot_units u
       JOIN bookings b ON b.id = u.booking_id
       WHERE u.unit_start >= ?1 AND u.unit_start < ?2
         AND (b.status IN ('confirmed', 'completed') OR (b.status = 'held' AND b.hold_expires_at > ?3))`,
    )
    .bind(dayStart, dayEnd, now)
    .all<{ unit_start: number }>();
  const taken = new Set(results.map((r) => r.unit_start));

  const earliest = now + settings.minNoticeMinutes * MINUTE;
  const slots: Slot[] = [];
  for (let m = open; m + durationMin <= close; m += settings.slotMinutes) {
    const startAt = istToUtc(date, m);
    if (startAt < earliest) continue;
    if (unitsFor(startAt, durationMin).some((u) => taken.has(u))) continue;
    slots.push({ value: hhmm(m), label: timeLabel(m), startAt });
  }
  return slots;
}
