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

/**
 * Contact page mode. Off (the default): the form only writes a WhatsApp message, nothing is
 * stored on the site. On: messages are saved to Admin → Messages and emailed to Satakshi.
 * Switched in Admin → Account → Settings.
 */
export async function contactInbox(db: D1Database) {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'contact_inbox'")
    .first<{ value: string }>();
  return row?.value === "1";
}

/** How many plans the home page deck shows (the Services page always lists all of them). */
export const HOME_CARDS = { min: 3, max: 12, fallback: 6 } as const;

export async function homeCards(db: D1Database) {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'home_cards'")
    .first<{ value: string }>();
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= HOME_CARDS.min && n <= HOME_CARDS.max ? n : HOME_CARDS.fallback;
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

/**
 * The 15-minute blocks a session covers, on a fixed grid (IST is UTC+5:30, so the grid
 * is the same in both). A start or length that isn't on the grid still claims every block
 * it touches, so two sessions that overlap by even a minute always share a block and the
 * database's primary key refuses the second one.
 */
export function unitsFor(startAt: number, durationMin: number) {
  const first = Math.floor(startAt / UNIT_MS) * UNIT_MS;
  const end = startAt + durationMin * MINUTE;
  const units: number[] = [];
  for (let t = first; t < end; t += UNIT_MS) units.push(t);
  return units;
}

export type SlotStatus = "free" | "booked";
export type Slot = { value: string; label: string; startAt: number; status: SlotStatus };

type Rule = { weekday: number; enabled: number; open_min: number; close_min: number };
type Override = { date: string; closed: number; open_min: number | null; close_min: number | null };

/** Everything needed to work out the times for a range of dates, read in one go. */
async function loadAvailability(
  db: D1Database,
  from: string,
  to: string,
  now: number,
  ignoreBooking: string,
) {
  const [settings, rules, overrides, taken] = await Promise.all([
    bookingSettings(db),
    db
      .prepare("SELECT weekday, enabled, open_min, close_min FROM availability_rules")
      .all<Rule>()
      .then((r) => new Map(r.results.map((x) => [x.weekday, x]))),
    db
      .prepare(
        "SELECT date, closed, open_min, close_min FROM availability_overrides WHERE date >= ?1 AND date <= ?2",
      )
      .bind(from, to)
      .all<Override>()
      .then((r) => new Map(r.results.map((x) => [x.date, x]))),
    db
      .prepare(
        `SELECT u.unit_start FROM booking_slot_units u
         JOIN bookings b ON b.id = u.booking_id
         WHERE u.unit_start >= ?1 AND u.unit_start < ?2 AND b.id != ?3
           AND b.status IN ('confirmed', 'completed')`,
      )
      .bind(istToUtc(from, 0), istToUtc(addDaysIso(to, 1), 0), ignoreBooking)
      .all<{ unit_start: number }>()
      .then((r) => new Set(r.results.map((x) => x.unit_start))),
  ]);
  return { settings, rules, overrides, taken, now };
}

type Availability = Awaited<ReturnType<typeof loadAvailability>>;

/** Opening hours for one date, after any day off or changed hours. Null when closed. */
function hoursOn(av: Availability, date: string) {
  const rule = av.rules.get(weekdayOf(date));
  const override = av.overrides.get(date);
  let open: number | null = rule?.enabled ? rule.open_min : null;
  let close: number | null = rule?.enabled ? rule.close_min : null;
  if (override) {
    if (override.closed) return null;
    if (override.open_min != null && override.close_min != null) {
      open = override.open_min;
      close = override.close_min;
    }
  }
  return open == null || close == null || close <= open ? null : { open, close };
}

/** Bookable start times on one date (past and too-soon times left out), each free or booked. */
function slotsOn(av: Availability, date: string, durationMin: number): Slot[] | null {
  const today = istToday(av.now);
  if (date < today || date > addDaysIso(today, av.settings.windowDays)) return null;
  const hours = hoursOn(av, date);
  if (!hours) return null;
  const earliest = av.now + av.settings.minNoticeMinutes * MINUTE;
  const slots: Slot[] = [];
  // Start on a quarter hour, so neighbouring sessions never share a 15-minute block.
  const first = Math.ceil(hours.open / 15) * 15;
  for (let m = first; m + durationMin <= hours.close; m += av.settings.slotMinutes) {
    const startAt = istToUtc(date, m);
    if (startAt < earliest) continue;
    const booked = unitsFor(startAt, durationMin).some((u) => av.taken.has(u));
    slots.push({ value: hhmm(m), label: timeLabel(m), startAt, status: booked ? "booked" : "free" });
  }
  return slots;
}

/** Every start time on one IST date, marked free or booked. Empty when the day is closed. */
export async function daySlots(
  db: D1Database,
  date: string,
  durationMin: number,
  now = Date.now(),
  ignoreBooking = "",
) {
  const av = await loadAvailability(db, date, date, now, ignoreBooking);
  return slotsOn(av, date, durationMin) ?? [];
}

/**
 * Free start times on one IST date for a session of `durationMin`.
 * Uses the weekly hours, any override for that date, the minimum notice, and the
 * blocks of confirmed bookings. A booking still awaiting payment doesn't block its time.
 */
export async function freeSlots(
  db: D1Database,
  date: string,
  durationMin: number,
  now = Date.now(),
  /** When moving a booking, its own blocks don't count as taken. */
  ignoreBooking = "",
) {
  return (await daySlots(db, date, durationMin, now, ignoreBooking)).filter((s) => s.status === "free");
}

export type DayStatus = "open" | "full" | "closed";

/** For each date in the booking window: open (a free time exists), full, or closed. */
export async function windowDays(db: D1Database, durationMin: number, now = Date.now()) {
  const today = istToday(now);
  const settings = await bookingSettings(db);
  const last = addDaysIso(today, settings.windowDays);
  const av = await loadAvailability(db, today, last, now, "");
  const days: { date: string; status: DayStatus }[] = [];
  for (let date = today; date <= last; date = addDaysIso(date, 1)) {
    const slots = slotsOn(av, date, durationMin);
    days.push({
      date,
      status:
        !slots || slots.length === 0 ? "closed" : slots.some((s) => s.status === "free") ? "open" : "full",
    });
  }
  return days;
}
