// India has no daylight saving, so IST is always UTC+5:30.
const IST_OFFSET_MS = 330 * 60_000;
export const MINUTE = 60_000;

/** "2026-11-03" + 660 minutes → Unix ms of 11:00 IST that day. */
export function istToUtc(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, 0, minutes) - IST_OFFSET_MS;
}

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDaysIso(date: string, days: number) {
  return new Date(istToUtc(date, 0) + IST_OFFSET_MS + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday, for a YYYY-MM-DD date. */
export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** A real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** 660 → "11:00", 1260 → "21:00". */
export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "11:00" → 660, or null. */
export function parseHhmm(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 660 → "11:00 am". */
export function timeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const min = String(minutes % 60).padStart(2, "0");
  return `${h % 12 || 12}:${min} ${h >= 12 ? "pm" : "am"}`;
}
