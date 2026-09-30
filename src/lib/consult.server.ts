import { siteOrigin } from "./orders.server";
import { HORIZON_DAYS, MIN_NOTICE_HOURS, SLOT_MINUTES, addDays, fmtDate, fmtHm, isoWeekday, warsawToUtc, warsawYmd } from "./consult";

export const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Free slots grouped by Warsaw date. Contains no data about who booked what. */
export async function computeSlots(now = new Date()): Promise<{ date: string; slots: string[] }[]> {
  const s = await db();
  const today = warsawYmd(now);
  const last = addDays(today, HORIZON_DAYS);
  const [{ data: av }, { data: blocked }, { data: booked }] = await Promise.all([
    s.from("consult_availability").select("weekday, start_time, end_time").eq("active", true),
    s.from("consult_blocked_dates").select("day").gte("day", today).lte("day", last),
    s.from("consult_bookings").select("starts_at, ends_at").eq("status", "booked").gte("ends_at", now.toISOString()),
  ]);
  const blockedSet = new Set((blocked ?? []).map((b) => b.day));
  const taken = (booked ?? []).map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const);
  const minStart = now.getTime() + MIN_NOTICE_HOURS * 3600_000;
  const out: { date: string; slots: string[] }[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const day = addDays(today, i);
    if (blockedSet.has(day)) continue;
    const wd = isoWeekday(day);
    const set = new Set<string>();
    for (const a of (av ?? []).filter((x) => x.weekday === wd)) {
      const [sh, sm] = a.start_time.split(":").map(Number);
      const [eh, em] = a.end_time.split(":").map(Number);
      for (let m = sh! * 60 + sm!; m + SLOT_MINUTES <= eh! * 60 + em!; m += SLOT_MINUTES) {
        const start = warsawToUtc(day, `${Math.floor(m / 60)}:${m % 60}`);
        const t = start.getTime(), e = t + SLOT_MINUTES * 60_000;
        if (t < minStart) continue;
        if (warsawYmd(start) !== day) continue; // non-existent local time on DST switch
        if (taken.some(([bs, be]) => t < be && e > bs)) continue;
        set.add(start.toISOString());
      }
    }
    if (set.size) out.push({ date: day, slots: [...set].sort() });
  }
  return out;
}

export async function logEvent(bookingId: string, type: string, detail: string | null, actor: string | null = null) {
  await (await db()).from("consult_booking_events").insert({ booking_id: bookingId, type, detail, actor });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = "confirmation" | "reminder" | "cancelled_user" | "cancelled_admin" | "admin_new" | "admin_cancelled";
type B = { id: string; booking_number: string; first_name: string; starts_at: string; meeting_link: string | null; access_token: string; user_id: string | null };

export function renderMail(kind: Mail, b: B) {
  const when = `${fmtDate(b.starts_at)}, godz. ${fmtHm(b.starts_at)}`;
  const link = b.meeting_link ? `<p>Link do spotkania: <a href="${esc(b.meeting_link)}" style="color:#c9a24a">${esc(b.meeting_link)}</a></p>` : "<p>Link do spotkania prześlemy przed rozmową.</p>";
  const change = b.user_id ? `<p>Szczegóły i anulowanie znajdziesz w sekcji „Moje TNB”: ${siteOrigin()}/moje-tnb</p>` : `<p>Zmiana lub anulowanie terminu wymaga kontaktu z organizatorem: ${siteOrigin()}/kontakt</p>`;
  const hi = `<p>Cześć ${esc(b.first_name)},</p>`;
  const m: Record<Mail, { subject: string; body: string }> = {
    confirmation: { subject: `Potwierdzenie rezerwacji ${b.booking_number}`, body: `${hi}<p>Twoja bezpłatna rozmowa 1:1 została zarezerwowana.</p><p><b>${when}</b> · 30 minut</p>${link}${change}` },
    reminder: { subject: `Przypomnienie: rozmowa 1:1 jutro`, body: `${hi}<p>Przypominamy o rozmowie <b>${when}</b> (30 minut).</p>${link}<p>Połącz się kilka minut wcześniej. Nie musisz się przygotowywać.</p>${change}` },
    cancelled_user: { subject: `Anulowano rezerwację ${b.booking_number}`, body: `${hi}<p>Twoja rezerwacja na <b>${when}</b> została anulowana.</p>` },
    cancelled_admin: { subject: `Organizator anulował rezerwację ${b.booking_number}`, body: `${hi}<p>Niestety rozmowa zaplanowana na <b>${when}</b> została odwołana przez organizatora. Zapraszamy do wyboru innego terminu: ${siteOrigin()}/spotkania/rozmowa-1-1</p>` },
    admin_new: { subject: `Nowa rezerwacja 1:1 ${b.booking_number}`, body: `<p>Nowa rezerwacja rozmowy 1:1 na <b>${when}</b>. Szczegóły w panelu administratora.</p>` },
    admin_cancelled: { subject: `Anulowano rezerwację 1:1 ${b.booking_number}`, body: `<p>Uczestnik anulował rozmowę zaplanowaną na <b>${when}</b>.</p>` },
  };
  const x = m[kind];
  return { subject: x.subject, html: `<!doctype html><html lang="pl"><body style="margin:0;background:#0f0f0f;font-family:Arial,sans-serif;color:#eee"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><p style="color:#c9a24a;letter-spacing:.2em;text-transform:uppercase;font-size:12px">Tata Na Baczności</p>${x.body}</div></body></html>` };
}

// Never reports success without a real delivery. Until a sender domain is connected every attempt is logged as skipped.
async function trySend(_to: string, _mail: { subject: string; html: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: st } = await (await db()).from("email_settings").select("sender_domain").eq("id", 1).maybeSingle();
  if (!st?.sender_domain) return { ok: false, reason: "sender_domain_not_configured" };
  return { ok: false, reason: "sender_not_connected" };
}

export async function sendBookingMail(kind: Mail, b: B & { email: string }) {
  const s = await db();
  let to: string | null = b.email;
  if (kind.startsWith("admin_")) {
    const { data: st } = await s.from("email_settings").select("notification_recipient").eq("id", 1).maybeSingle();
    to = st?.notification_recipient ?? null;
  }
  const r = to ? await trySend(to, renderMail(kind, b)) : { ok: false as const, reason: "recipient_not_configured" };
  await s.from("email_notification_log").insert({ kind: `consult_${kind}`, related_id: b.id, status: r.ok ? "sent" : "skipped", reason: r.ok ? null : r.reason, recipient: to });
  return r;
}

const COLS = "id, booking_number, first_name, email, starts_at, meeting_link, access_token, user_id";

/** Sends 24h reminders for active bookings. Cancelled bookings are never reminded. */
export async function processReminders(now = new Date()) {
  const s = await db();
  const { data } = await s.from("consult_bookings").select(COLS).eq("status", "booked").eq("reminder_status", "pending")
    .gt("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString()).limit(100);
  let sent = 0, skipped = 0;
  for (const b of data ?? []) {
    const r = await sendBookingMail("reminder", b);
    await s.from("consult_bookings").update({ reminder_status: r.ok ? "sent" : "skipped", reminder_error: r.ok ? null : r.reason, reminder_at: now.toISOString() }).eq("id", b.id).eq("status", "booked");
    await logEvent(b.id, r.ok ? "reminder_sent" : "reminder_skipped", r.ok ? null : r.reason);
    r.ok ? sent++ : skipped++;
  }
  return { checked: data?.length ?? 0, sent, skipped };
}
