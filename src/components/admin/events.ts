// Presentation layer for admin_events.type — the stored type stays technical.
const STATUS: Record<string, string> = { published: "Opublikowano", draft: "Cofnięto do szkicu", archived: "Zarchiwizowano", edit: "Edytowano", create: "Utworzono" };
const OBJECT: Record<string, [string, string]> = {
  page: ["page", "stronę"], library: ["library", "materiał Biblioteki"], episode: ["episode", "odcinek podcastu"], meeting: ["meeting", "spotkanie"], article: ["article", "artykuł"],
};

export const EVENT_LABELS: Record<string, string> = {
  article_category_save: "Zapisano kategorię artykułów",
  article_category_delete: "Usunięto kategorię artykułów",
  article_home_mode: "Zmieniono artykuły na stronie głównej",
  article_poll_save: "Zapisano ankietę artykułu",
  article_poll_delete: "Usunięto ankietę artykułu",
  article_comment_hide: "Ukryto komentarz pod artykułem",
  article_comment_show: "Przywrócono komentarz pod artykułem",
  article_comment_delete: "Usunięto komentarz pod artykułem",
  article_comment_dismiss: "Odrzucono zgłoszenie komentarza",
  article_comment_reject: "Odrzucono komentarz gościa",
  article_comment_guest_submitted: "Gość dodał komentarz (czeka na potwierdzenie e-mail)",
  article_comment_confirmed: "Gość potwierdził komentarz — opublikowano",
  article_comment_confirm_expired: "Link potwierdzający komentarz wygasł",
  article_comment_confirm_blocked: "Zablokowano potwierdzenie komentarza (moderacja)",
  article_comment_confirm_resent: "Ponownie wysłano link potwierdzający komentarz",
  access_denied: "Odmowa dostępu lub nieuprawniona operacja",
  settings_update: "Zmieniono ustawienia",
  maintenance_on: "Włączono tryb konserwacji",
  maintenance_off: "Wyłączono tryb konserwacji",
  role_granted: "Nadano rolę użytkownikowi",
  role_revoked: "Odebrano rolę użytkownikowi",
  order_paid: "Potwierdzono przelew za zamówienie",
  order_refund_start: "Rozpoczęto zwrot zamówienia",
  order_refund_complete: "Zakończono zwrot zamówienia",
  order_review_paid: "Weryfikacja: płatność poprawna",
  order_review_failed: "Weryfikacja: płatność nieudana",
  order_resend: "Ponowne wysłanie linku do materiału",
  payment_webhook: "Powiadomienie operatora płatności",
  payment_webhook_invalid: "Odrzucone powiadomienie płatności (podpis)",
  payment_config: "Zmiana konfiguracji operatora płatności",
  payment_live_on: "Włączono produkcję operatora płatności",
  payment_live_off: "Przełączono operatora na środowisko testowe",
  payment_test: "Test połączenia z operatorem płatności",
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
  media_upload: "Dodano plik w Multimediach",
  media_delete: "Usunięcie pliku z Multimediów",
  media_rejected: "Odrzucono przesyłany plik",
  template_update: "Zmieniono szablon wiadomości",
  template_reset: "Przywrócono domyślny szablon wiadomości",
  rule_enabled: "Włączono regułę powiadomień",
  rule_disabled: "Wyłączono regułę powiadomień",
  email_test: "Wysłano wiadomość testową",
  email_retry: "Ponowiono wysyłkę wiadomości",
};
for (const [prefix, [, noun]] of Object.entries(OBJECT)) {
  for (const [st, verb] of Object.entries(STATUS)) EVENT_LABELS[`${prefix}_${st}`] = `${verb} ${noun}`;
}

export const eventLabel = (t: string) => EVENT_LABELS[t] ?? `Inne zdarzenie (${t})`;

export const EVENT_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "page", label: "Strony" }, { value: "article", label: "Artykuły" }, { value: "library", label: "Biblioteka" }, { value: "episode", label: "Podcast" },
  { value: "meeting", label: "Spotkania" }, { value: "registration", label: "Zgłoszenia na spotkania" }, { value: "booking", label: "Rozmowy 1:1" }, { value: "role", label: "Role użytkowników" },
  { value: "order", label: "Zamówienia" }, { value: "community", label: "Społeczność" }, { value: "report", label: "Zgłoszenia moderacyjne" },
  { value: "access", label: "Dostęp" }, { value: "settings", label: "Ustawienia" }, { value: "maintenance", label: "Tryb konserwacji" },
  { value: "media", label: "Multimedia" }, { value: "template", label: "Szablony wiadomości" }, { value: "rule", label: "Reguły powiadomień" }, { value: "email", label: "Wysyłka e-mail" },
];

export const OBJECT_KIND: Record<string, string> = {
  page: "Strona", article: "Artykuł", article_comment: "Komentarz", library: "Materiał", episode: "Odcinek", meeting: "Spotkanie", registration: "Zgłoszenie", booking: "Rozmowa 1:1",
  order: "Zamówienie", post: "Post", comment: "Komentarz", report: "Zgłoszenie", availability: "Dostępność", user: "Użytkownik", settings: "Ustawienia", media: "Plik", template: "Szablon", rule: "Reguła", notification: "Wiadomość", payment: "Płatność",
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
