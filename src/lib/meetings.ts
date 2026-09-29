// Shared, browser-safe constants and helpers for the Spotkania module.
export type MeetingKind = "online" | "live";
export type MeetingStatus = "draft" | "published" | "archived";
export type RegStatus = "pending" | "approved" | "rejected" | "cancelled";

export const MEETING_KINDS: Record<MeetingKind, string> = { online: "Spotkanie online", live: "Spotkanie na żywo" };
export const MEETING_STATUS: Record<MeetingStatus, string> = { draft: "Szkic", published: "Opublikowane", archived: "Zarchiwizowane" };
export const REG_STATUS: Record<RegStatus, string> = { pending: "Oczekuje na decyzję", approved: "Zatwierdzone", rejected: "Odrzucone", cancelled: "Anulowane" };

export type PublicMeeting = {
  id: string; slug: string; title: string; kind: MeetingKind; summary: string;
  starts_at: string; ends_at: string | null; location: string | null; has_image: boolean;
  capacity: number | null; taken: number; registration_open: boolean; requires_login: boolean; requires_approval: boolean;
};
export type MeetingDetail = PublicMeeting & { description: string; rules: string };

export const meetingImage = (m: { id: string; has_image: boolean }) => (m.has_image ? `/api/public/meeting-image/${m.id}` : null);
export const isPast = (m: { starts_at: string; ends_at: string | null }) => new Date(m.ends_at ?? m.starts_at).getTime() < Date.now();
export const freeSeats = (m: { capacity: number | null; taken: number }) => (m.capacity == null ? null : Math.max(0, m.capacity - m.taken));

export function regState(m: PublicMeeting): { label: string; canRegister: boolean } {
  if (isPast(m)) return { label: "Spotkanie zakończone", canRegister: false };
  if (!m.registration_open) return { label: "Zapisy zamknięte", canRegister: false };
  const free = freeSeats(m);
  if (free === 0) return { label: "Brak wolnych miejsc", canRegister: false };
  return { label: free == null ? "Zapisy otwarte" : `Zapisy otwarte · wolne miejsca: ${free}`, canRegister: true };
}

const TZ = "Europe/Warsaw";
export const fmtWhen = (s: string) =>
  new Date(s).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
