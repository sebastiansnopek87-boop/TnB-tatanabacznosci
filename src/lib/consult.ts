// Shared (browser + server) helpers for 1:1 consultations. All wall-clock logic uses Europe/Warsaw (DST-aware).
export const TZ = "Europe/Warsaw";
export const SLOT_MINUTES = 30;
export const MIN_NOTICE_HOURS = 2;
export const HORIZON_DAYS = 60;
export const CANCEL_LIMIT_HOURS = 2;

export const BOOKING_STATUS = {
  booked: "Zarezerwowana",
  cancelled_user: "Anulowana przez użytkownika",
  cancelled_admin: "Anulowana przez organizatora",
  completed: "Zakończona",
  no_show: "Nieodbyta",
} as const;
export type BookingStatus = keyof typeof BOOKING_STATUS;

export const MAIL_STATUS: Record<string, string> = { pending: "Oczekuje", sent: "Wysłano", skipped: "Nie wysłano", failed: "Błąd wysyłki", not_needed: "Nie dotyczy" };

export const CANCEL_REASONS = [
  "Nie mogę uczestniczyć w wybranym terminie.",
  "Zmieniły się moje plany.",
  "Problem techniczny lub organizacyjny.",
  "Potrzebuję innego terminu.",
  "Inny powód",
] as const;

export const WEEKDAYS = ["", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o['year']!, m: o['month']!, d: o['day']!, h: (o['hour'] ?? 0) % 24, mi: o['minute']!, s: o['second']! };
};
const offsetMs = (d: Date) => { const p = parts(d); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000; };

/** Converts a Warsaw wall-clock date ("2026-10-25") + time ("10:30") to a UTC Date. */
export function warsawToUtc(ymd: string, hm: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, mi!);
  let t = guess - offsetMs(new Date(guess));
  const off2 = offsetMs(new Date(t));
  t = guess - off2;
  return new Date(t);
}
export const warsawYmd = (d: Date) => { const p = parts(d); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
export const warsawHm = (d: Date) => { const p = parts(d); return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`; };
/** ISO weekday 1 (Mon) … 7 (Sun) for a calendar date. */
export const isoWeekday = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); const w = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); return w === 0 ? 7 : w; };
export const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); const t = new Date(Date.UTC(y!, m! - 1, d! + n)); return t.toISOString().slice(0, 10); };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtDate = (iso: string) => cap(new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }));
export const fmtHm = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const fmtDayLabel = (ymd: string) => cap(new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }));

export const canUserCancel = (startsAt: string, now = Date.now()) => new Date(startsAt).getTime() - now >= CANCEL_LIMIT_HOURS * 3600_000;
