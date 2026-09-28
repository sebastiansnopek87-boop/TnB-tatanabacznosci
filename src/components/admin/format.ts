export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" }) : "—";

export const MSG_STATUS: Record<string, string> = { new: "Nowa", read: "Przeczytana", archived: "Zarchiwizowana" };
export const SUB_STATUS: Record<string, string> = { pending: "Oczekuje", active: "Aktywny", unsubscribed: "Wypisany" };
export const LOG_STATUS: Record<string, string> = { sent: "Wysłano", skipped: "Pominięto", failed: "Błąd", suppressed: "Zablokowano" };
export const LOG_KIND: Record<string, string> = { contact_message: "Wiadomość z Kontaktu", newsletter_signup: "Zapis do newslettera" };
export const LOG_REASON: Record<string, string> = {
  notification_disabled: "Powiadomienia tego typu są wyłączone",
  recipient_not_configured: "Nie ustawiono adresu odbiorcy",
  sender_domain_not_configured: "Nie ustawiono domeny nadawcy",
  sender_not_connected: "Wysyłka e-mail nie jest jeszcze uruchomiona",
  internal_error: "Błąd wewnętrzny serwera",
};

export function AdminTitle({ title, intro }: { title: string; intro?: string }) {
  return null as unknown as never; // placeholder never used
}
