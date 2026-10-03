// Shared, browser-safe constants and helpers for the Spotkania module.
export type MeetingKind = "online" | "live";
export type MeetingStatus = "draft" | "published" | "archived";
export type RegStatus = "pending" | "approved" | "rejected" | "cancelled";

export const MEETING_KINDS: Record<MeetingKind, string> = { online: "Webinar online", live: "Spotkanie LIVE" };
export const MEETING_STATUS: Record<MeetingStatus, string> = { draft: "Szkic", published: "Opublikowane", archived: "Zarchiwizowane" };
export const REG_STATUS: Record<RegStatus, string> = { pending: "Oczekuje na decyzję", approved: "Zatwierdzone", rejected: "Odrzucone", cancelled: "Anulowane" };
export const DIFFICULTY: Record<string, string> = { latwa: "Łatwa", srednia: "Średnia", trudna: "Trudna" };

export type PublicMeeting = {
  id: string; slug: string; title: string; kind: MeetingKind; summary: string;
  starts_at: string; ends_at: string | null; location: string | null; has_image: boolean;
  capacity: number | null; taken: number; registration_open: boolean; requires_login: boolean; requires_approval: boolean;
  host: string; venue_name: string; is_outdoor: boolean; cancelled: boolean; cancel_reason: string | null;
  has_recording: boolean; fee_info: string; difficulty: string; route_length: string; route_duration: string;
};
export type MeetingDetail = PublicMeeting & {
  description: string; rules: string; equipment: string; organizer_contact: string; cancellation_policy: string;
  preparation: string; org_notes: string; address: string | null; meeting_point: string | null; map_url: string | null;
  user_can_cancel: boolean; join_open_minutes: number;
};

export const meetingImage = (m: { id: string; has_image: boolean }) => (m.has_image ? `/api/public/meeting-image/${m.id}` : null);
/** Effective end: explicit end or start + 2h. */
export const endOf = (m: { starts_at: string; ends_at: string | null }) => (m.ends_at ? new Date(m.ends_at).getTime() : new Date(m.starts_at).getTime() + 2 * 3600_000);
export const isPast = (m: { starts_at: string; ends_at: string | null }) => endOf(m) < Date.now();
export const freeSeats = (m: { capacity: number | null; taken: number }) => (m.capacity == null ? null : Math.max(0, m.capacity - m.taken));

export function regState(m: PublicMeeting): { label: string; canRegister: boolean } {
  if (m.cancelled) return { label: "Odwołane", canRegister: false };
  if (isPast(m)) return { label: "Zakończone", canRegister: false };
  if (!m.registration_open) return { label: "Zapisy zamknięte", canRegister: false };
  const free = freeSeats(m);
  if (free === 0) return { label: "Brak miejsc", canRegister: false };
  return { label: free == null ? "Zapisy otwarte" : `Zapisy otwarte · wolne miejsca: ${free}`, canRegister: true };
}

/** Card/detail badges in TNB wording. */
export function badges(m: PublicMeeting): { label: string; tone: "gold" | "muted" | "danger" }[] {
  const out: { label: string; tone: "gold" | "muted" | "danger" }[] = [{ label: m.kind === "online" ? "WEBINAR ONLINE" : "SPOTKANIE LIVE", tone: "gold" }];
  if (m.kind === "live" && m.is_outdoor) out.push({ label: "W TERENIE", tone: "gold" });
  if (m.cancelled) out.push({ label: "ODWOŁANE", tone: "danger" });
  else if (isPast(m)) out.push({ label: "ZAKOŃCZONE", tone: "muted" });
  else if (m.registration_open && freeSeats(m) === 0) out.push({ label: "BRAK MIEJSC", tone: "muted" });
  else if (m.registration_open) out.push({ label: "ZAPISY OTWARTE", tone: "gold" });
  return out;
}

const TZ = "Europe/Warsaw";
export const fmtWhen = (s: string) =>
  new Date(s).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export function countdown(ms: number) {
  if (ms <= 0) return "teraz";
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d} d ${h} godz.` : h ? `${h} godz. ${mm} min` : `${mm} min`;
}

/** Shape returned to an entitled participant (own registration). */
export type MyReg = {
  status: RegStatus; token: string; link: string | null; joinOpensAt: string | null; recording: string | null;
  address: string | null; meeting_point: string | null; map_url: string | null; canCancel: boolean;
};
