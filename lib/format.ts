const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(paise: number) {
  return inr.format(paise / 100);
}

/** 45 → "45 min", 60 → "1 hour", 90 → "1 hour 30 min", 120 → "2 hours". */
export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = `${h} ${h === 1 ? "hour" : "hours"}`;
  return m ? `${hours} ${m} min` : hours;
}

/** 60 → "1 hour session": says what the length is for. */
export function formatSessionLength(min: number) {
  return `${formatDuration(min)} session`;
}
