export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" }) : "—";

export const MSG_STATUS: Record<string, string> = { new: "Nowa", read: "Przeczytana", archived: "Zarchiwizowana" };
export const SUB_STATUS: Record<string, string> = { pending: "Oczekuje", active: "Aktywny", unsubscribed: "Wypisany" };
export const LOG_STATUS: Record<string, string> = {
  pending: "Oczekuje", sending: "W trakcie wysyłki", sent: "Wysłano", delivered: "Dostarczono", failed: "Błąd", cancelled: "Anulowano",
  skipped: "Pominięto", suppressed: "Zablokowano", simulated: "Symulacja (nie wysłano)",
};
export const LOG_REASON: Record<string, string> = {
  notification_disabled: "Powiadomienia tego typu są wyłączone",
  recipient_not_configured: "Nie ustawiono adresu odbiorcy",
  sender_domain_not_configured: "Nie ustawiono domeny nadawcy",
  sender_not_connected: "Wysyłka e-mail nie jest jeszcze uruchomiona",
  internal_error: "Błąd wewnętrzny serwera",
  event_not_integrated: "Zdarzenie oczekuje na integrację",
  provider_error: "Błąd dostawcy poczty",
  unknown_event: "Nieznane zdarzenie",
};


// Maps server errors to Polish messages; expired/missing session gets a clear hint.
export const logReason = (r: string | null) => {
  if (!r) return "—";
  if (r.startsWith("missing_variables:")) return `Brak wartości zmiennych: ${r.slice(18).split(",").join(", ")}`;
  return LOG_REASON[r] ?? r;
};

export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/unauthori[sz]ed|401|jwt|token/i.test(m)) return "Sesja wygasła. Zaloguj się ponownie.";
  if (/failed to fetch|network/i.test(m)) return "Brak połączenia z serwerem. Spróbuj ponownie.";
  return m || "Wystąpił nieoczekiwany błąd.";
}
export const isSessionError = (e: unknown) => errMsg(e).startsWith("Sesja wygasła");
