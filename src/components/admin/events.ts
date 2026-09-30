// Presentation layer for admin_events.type — the stored type stays technical.
const STATUS: Record<string, string> = { published: "Opublikowano", draft: "Cofnięto do szkicu", archived: "Zarchiwizowano", edit: "Edytowano", create: "Utworzono" };
const OBJECT: Record<string, [string, string]> = {
  page: ["page", "stronę"], library: ["library", "materiał Biblioteki"], episode: ["episode", "odcinek podcastu"], meeting: ["meeting", "spotkanie"],
};

export const EVENT_LABELS: Record<string, string> = {
  access_denied: "Odmowa dostępu lub nieuprawniona operacja",
  settings_update: "Zmieniono ustawienia",
  maintenance_on: "Włączono tryb konserwacji",
  maintenance_off: "Wyłączono tryb konserwacji",
  role_granted: "Nadano rolę użytkownikowi",
  role_revoked: "Odebrano rolę użytkownikowi",
  order_paid: "Oznaczono zamówienie jako opłacone",
  order_delivered: "Oznaczono zamówienie jako dostarczone",
  order_cancelled: "Anulowano zamówienie",
  order_refunded: "Oznaczono zwrot zamówienia",
  community_hide: "Ukryto post w Społeczności",
  community_restore: "Przywrócono post w Społeczności",
  community_delete_post: "Usunięto post ze Społeczności",
  community_delete_comment: "Usunięto komentarz ze Społeczności",
  community_set_visibility: "Zmieniono widoczność posta",
  report_resolved: "Zamknięto zgłoszenie moderacyjne",
  registration_approved: "Zatwierdzono zgłoszenie na spotkanie",
  registration_rejected: "Odrzucono zgłoszenie na spotkanie",
  registration_cancelled: "Anulowano zgłoszenie na spotkanie",
  registration_pending: "Przywrócono zgłoszenie do oczekujących",
  registration_attendance: "Zmieniono obecność uczestnika",
  booking_link_changed: "Zmieniono link rozmowy 1:1",
  booking_cancelled_admin: "Anulowano rozmowę 1:1",
  booking_completed: "Oznaczono rozmowę 1:1 jako zakończoną",
  booking_no_show: "Oznaczono rozmowę 1:1 jako nieodbytą",
  availability_saved: "Zapisano dostępność rozmów 1:1",
  date_blocked: "Zablokowano dzień dla rozmów 1:1",
  date_unblocked: "Odblokowano dzień dla rozmów 1:1",
};
for (const [prefix, [, noun]] of Object.entries(OBJECT)) {
  for (const [st, verb] of Object.entries(STATUS)) EVENT_LABELS[`${prefix}_${st}`] = `${verb} ${noun}`;
}

export const eventLabel = (t: string) => EVENT_LABELS[t] ?? `Inne zdarzenie (${t})`;

export const EVENT_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "page", label: "Strony" }, { value: "library", label: "Biblioteka" }, { value: "episode", label: "Podcast" },
  { value: "meeting", label: "Spotkania" }, { value: "registration", label: "Zgłoszenia na spotkania" }, { value: "booking", label: "Rozmowy 1:1" }, { value: "role", label: "Role użytkowników" },
  { value: "order", label: "Zamówienia" }, { value: "community", label: "Społeczność" }, { value: "report", label: "Zgłoszenia moderacyjne" },
  { value: "access", label: "Dostęp" }, { value: "settings", label: "Ustawienia" }, { value: "maintenance", label: "Tryb konserwacji" },
];

export const OBJECT_KIND: Record<string, string> = {
  page: "Strona", library: "Materiał", episode: "Odcinek", meeting: "Spotkanie", registration: "Zgłoszenie", booking: "Rozmowa 1:1",
  order: "Zamówienie", post: "Post", comment: "Komentarz", report: "Zgłoszenie", availability: "Dostępność", user: "Użytkownik", settings: "Ustawienia",
};
export const RESULT: Record<string, string> = { ok: "Wykonano", failed: "Błąd", denied: "Odmowa dostępu" };

// Only the part before @ plus domain initial: enough to recognize an admin, not a full address.
export const actorName = (email: string | null, actor: string | null) => {
  if (!actor) return "System";
  if (!email) return "Nieznane konto";
  const [u, d] = email.split("@");
  return `${u}@${(d ?? "").charAt(0)}…`;
};

export const typesMatching = (q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return Object.entries(EVENT_LABELS).filter(([, l]) => l.toLowerCase().includes(s)).map(([t]) => t);
};
