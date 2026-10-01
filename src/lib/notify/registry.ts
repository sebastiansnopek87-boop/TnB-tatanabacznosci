// Notification registry: events, default templates and variables. Pure data,
// safe for client and server. Stored overrides live in email_templates;
// enable/disable overrides in notification_rules (or email_settings for the
// two legacy admin toggles).

export type VarDef = { key: string; label: string; sample: string; sensitive?: boolean; url?: boolean };

export const VARIABLES: VarDef[] = [
  { key: "imie", label: "Imię", sample: "Jan" },
  { key: "nazwisko", label: "Nazwisko", sample: "Kowalski" },
  { key: "email", label: "Adres e-mail", sample: "jan@example.com" },
  { key: "nazwa_platformy", label: "Nazwa platformy (automatycznie)", sample: "Tata Na Baczności" },
  { key: "tytul_materialu", label: "Tytuł materiału", sample: "Ojciec w czasach próby" },
  { key: "kwota", label: "Kwota", sample: "49,00 zł" },
  { key: "numer_zamowienia", label: "Numer zamówienia", sample: "TNB-2026-0042" },
  { key: "link_do_materialu", label: "Link do materiału", sample: "https://tatanabacznosci.pl/biblioteka/przyklad", url: true, sensitive: true },
  { key: "link_do_logowania", label: "Link do logowania", sample: "https://tatanabacznosci.pl/auth", url: true },
  { key: "link_do_potwierdzenia", label: "Link do potwierdzenia", sample: "https://tatanabacznosci.pl/potwierdz/przyklad", url: true, sensitive: true },
  { key: "data_spotkania", label: "Data spotkania", sample: "12.10.2026" },
  { key: "godzina_spotkania", label: "Godzina spotkania", sample: "19:00" },
  { key: "link_do_spotkania", label: "Link do spotkania", sample: "https://meet.example.com/abc", url: true, sensitive: true },
  { key: "temat_wiadomosci", label: "Temat wiadomości", sample: "Pytanie o spotkania" },
  { key: "link_do_panelu", label: "Link do panelu", sample: "https://tatanabacznosci.pl/admin", url: true },
];
export const VAR_MAP: Record<string, VarDef> = Object.fromEntries(VARIABLES.map((v) => [v.key, v]));
export const AUTO_VARS = ["nazwa_platformy"];

export type TemplateDef = { key: string; name: string; subject: string; html: string; text: string; required: string[] };

type Spec = { subject: string; heading: string; lines: string[]; cta?: { label: string; v: string } };

function build(key: string, name: string, s: Spec): TemplateDef {
  const html = [
    `<h1>${s.heading}</h1>`,
    ...s.lines.map((l) => `<p>${l}</p>`),
    s.cta ? `<p><a class="btn" href="{{${s.cta.v}}}">${s.cta.label}</a></p>` : "",
  ].filter(Boolean).join("\n");
  const text = [s.heading, "", ...s.lines, ...(s.cta ? ["", `${s.cta.label}: {{${s.cta.v}}}`] : []), "", "— {{nazwa_platformy}}"].join("\n");
  const required = Array.from(new Set((s.subject + html).match(/\{\{\s*([a-z_]+)\s*\}\}/g)?.map((m) => m.replace(/[{}\s]/g, "")) ?? []))
    .filter((k) => !AUTO_VARS.includes(k));
  return { key, name, subject: s.subject, html, text, required };
}

export type Module = "konto" | "biblioteka" | "zamowienia" | "spotkania" | "rozmowy" | "formularze" | "system";
export const MODULE_LABEL: Record<Module, string> = {
  konto: "Konto użytkownika", biblioteka: "Biblioteka i podcast", zamowienia: "Materiały premium i zamówienia",
  spotkania: "Spotkania", rozmowy: "Rozmowy 1:1", formularze: "Społeczność i formularze", system: "System",
};

// integrated = the module really emits this event; pending = template ready,
// module does not call it yet; auth = sent by the built-in sign-in system.
export type Integration = "integrated" | "pending" | "auth";
export type EventDef = { key: string; module: Module; name: string; description: string; recipient: "user" | "admin"; integration: Integration };

const E = (key: string, module: Module, name: string, description: string, recipient: "user" | "admin", integration: Integration, spec: Spec) =>
  ({ ev: { key, module, name, description, recipient, integration } as EventDef, tpl: build(key, name, spec) });

const hi = "Dzień dobry {{imie}},";
const DEFS = [
  E("account_registered", "konto", "Rejestracja", "Nowe konto zostało założone.", "user", "auth",
    { subject: "Witamy w {{nazwa_platformy}}", heading: "Dziękujemy za rejestrację", lines: [hi, "Twoje konto zostało utworzone. Potwierdź adres e-mail, aby z niego korzystać."], cta: { label: "Potwierdź adres e-mail", v: "link_do_potwierdzenia" } }),
  E("account_email_confirm", "konto", "Potwierdzenie adresu e-mail", "Prośba o potwierdzenie adresu.", "user", "auth",
    { subject: "Potwierdź adres e-mail", heading: "Potwierdź adres e-mail", lines: [hi, "Kliknij przycisk, aby potwierdzić adres {{email}}."], cta: { label: "Potwierdzam", v: "link_do_potwierdzenia" } }),
  E("account_welcome", "konto", "Powitanie po aktywacji konta", "Wysyłane po potwierdzeniu adresu.", "user", "pending",
    { subject: "Twoje konto jest aktywne", heading: "Witaj na pokładzie", lines: [hi, "Twoje konto w {{nazwa_platformy}} jest aktywne."], cta: { label: "Zaloguj się", v: "link_do_logowania" } }),
  E("account_password_reset", "konto", "Reset hasła", "Link do ustawienia nowego hasła.", "user", "auth",
    { subject: "Ustaw nowe hasło", heading: "Reset hasła", lines: [hi, "Otrzymaliśmy prośbę o zmianę hasła. Jeśli to nie Ty, zignoruj tę wiadomość."], cta: { label: "Ustaw nowe hasło", v: "link_do_potwierdzenia" } }),
  E("account_email_change", "konto", "Zmiana adresu e-mail", "Potwierdzenie nowego adresu.", "user", "auth",
    { subject: "Potwierdź zmianę adresu e-mail", heading: "Zmiana adresu e-mail", lines: [hi, "Potwierdź, że chcesz używać adresu {{email}}."], cta: { label: "Potwierdź zmianę", v: "link_do_potwierdzenia" } }),

  E("library_access_granted", "biblioteka", "Przyznanie dostępu do materiału", "Administrator przyznał dostęp.", "user", "pending",
    { subject: "Masz dostęp: {{tytul_materialu}}", heading: "Dostęp przyznany", lines: [hi, "Otrzymałeś dostęp do materiału „{{tytul_materialu}}”."], cta: { label: "Otwórz materiał", v: "link_do_materialu" } }),
  E("library_purchase", "biblioteka", "Zakup materiału", "Złożono zamówienie na materiał.", "user", "pending",
    { subject: "Zamówienie {{numer_zamowienia}}", heading: "Dziękujemy za zamówienie", lines: [hi, "Zamówiłeś „{{tytul_materialu}}” za {{kwota}}. Numer zamówienia: {{numer_zamowienia}}."] }),
  E("library_payment_confirmed", "biblioteka", "Potwierdzenie płatności", "Wpłata potwierdzona przez administratora.", "user", "pending",
    { subject: "Płatność potwierdzona — {{numer_zamowienia}}", heading: "Płatność potwierdzona", lines: [hi, "Otrzymaliśmy wpłatę {{kwota}} za „{{tytul_materialu}}”."], cta: { label: "Otwórz materiał", v: "link_do_materialu" } }),
  E("library_payment_failed", "biblioteka", "Nieudana płatność", "Płatność nie została zaksięgowana.", "user", "pending",
    { subject: "Problem z płatnością — {{numer_zamowienia}}", heading: "Płatność nieudana", lines: [hi, "Nie udało się zaksięgować płatności {{kwota}} za zamówienie {{numer_zamowienia}}."] }),
  E("library_new_material", "biblioteka", "Nowy materiał dla użytkownika", "Udostępnienie nowego materiału (wymaga włączenia).", "user", "pending",
    { subject: "Nowy materiał: {{tytul_materialu}}", heading: "Nowy materiał", lines: [hi, "Udostępniliśmy Ci „{{tytul_materialu}}”."], cta: { label: "Zobacz", v: "link_do_materialu" } }),

  E("order_created", "zamowienia", "Utworzenie zamówienia", "Zamówienie z danymi do przelewu.", "user", "pending",
    { subject: "Zamówienie {{numer_zamowienia}} przyjęte", heading: "Zamówienie przyjęte", lines: [hi, "Przyjęliśmy zamówienie {{numer_zamowienia}} na kwotę {{kwota}}. Dostęp otrzymasz po zaksięgowaniu wpłaty."] }),
  E("order_paid", "zamowienia", "Potwierdzenie płatności", "Wysyłane dopiero po potwierdzeniu wpłaty na serwerze.", "user", "pending",
    { subject: "Płatność za {{numer_zamowienia}} potwierdzona", heading: "Dziękujemy za wpłatę", lines: [hi, "Potwierdziliśmy wpłatę {{kwota}} za zamówienie {{numer_zamowienia}}."] }),
  E("order_access_delivered", "zamowienia", "Przekazanie dostępu", "Dostęp do zakupionej treści.", "user", "pending",
    { subject: "Twój dostęp: {{tytul_materialu}}", heading: "Materiał gotowy", lines: [hi, "„{{tytul_materialu}}” czeka na Ciebie."], cta: { label: "Otwórz materiał", v: "link_do_materialu" } }),
  E("order_cancelled", "zamowienia", "Anulowanie zamówienia", "Zamówienie zostało anulowane.", "user", "pending",
    { subject: "Zamówienie {{numer_zamowienia}} anulowane", heading: "Zamówienie anulowane", lines: [hi, "Zamówienie {{numer_zamowienia}} zostało anulowane."] }),
  E("order_refunded", "zamowienia", "Zwrot płatności", "Zwrot środków za zamówienie.", "user", "pending",
    { subject: "Zwrot za {{numer_zamowienia}}", heading: "Zwrot płatności", lines: [hi, "Zwróciliśmy {{kwota}} za zamówienie {{numer_zamowienia}}."] }),
  E("order_admin_new", "zamowienia", "Nowe zamówienie (administrator)", "Powiadomienie administratora o nowym zamówieniu.", "admin", "pending",
    { subject: "Nowe zamówienie {{numer_zamowienia}}", heading: "Nowe zamówienie", lines: ["Złożono zamówienie {{numer_zamowienia}} na „{{tytul_materialu}}” ({{kwota}})."], cta: { label: "Otwórz panel", v: "link_do_panelu" } }),

  E("meeting_registration", "spotkania", "Zgłoszenie na spotkanie", "Potwierdzenie przyjęcia zgłoszenia.", "user", "integrated",
    { subject: "Zgłoszenie przyjęte — {{data_spotkania}}", heading: "Zgłoszenie przyjęte", lines: [hi, "Przyjęliśmy zgłoszenie na spotkanie {{data_spotkania}} o {{godzina_spotkania}}."] }),
  E("meeting_approved", "spotkania", "Potwierdzenie udziału", "Zgłoszenie zatwierdzone.", "user", "integrated",
    { subject: "Do zobaczenia {{data_spotkania}}", heading: "Udział potwierdzony", lines: [hi, "Twój udział w spotkaniu {{data_spotkania}} o {{godzina_spotkania}} jest potwierdzony."], cta: { label: "Dołącz do spotkania", v: "link_do_spotkania" } }),
  E("meeting_rejected", "spotkania", "Odrzucenie zgłoszenia", "Zgłoszenie odrzucone.", "user", "integrated",
    { subject: "Informacja o zgłoszeniu", heading: "Zgłoszenie nieprzyjęte", lines: [hi, "Niestety nie możemy przyjąć zgłoszenia na spotkanie {{data_spotkania}}."] }),
  E("meeting_rescheduled", "spotkania", "Zmiana terminu spotkania", "Nowy termin spotkania.", "user", "integrated",
    { subject: "Nowy termin spotkania", heading: "Zmiana terminu", lines: [hi, "Spotkanie odbędzie się {{data_spotkania}} o {{godzina_spotkania}}."] }),
  E("meeting_cancelled", "spotkania", "Odwołanie spotkania", "Spotkanie odwołane.", "user", "pending",
    { subject: "Spotkanie odwołane", heading: "Spotkanie odwołane", lines: [hi, "Spotkanie zaplanowane na {{data_spotkania}} zostało odwołane."] }),
  E("meeting_reminder", "spotkania", "Przypomnienie o spotkaniu", "Przed nadchodzącym spotkaniem.", "user", "pending",
    { subject: "Przypomnienie: spotkanie {{data_spotkania}}", heading: "Przypomnienie", lines: [hi, "Przypominamy o spotkaniu {{data_spotkania}} o {{godzina_spotkania}}."], cta: { label: "Dołącz", v: "link_do_spotkania" } }),

  E("booking_created", "rozmowy", "Utworzenie rezerwacji", "Rezerwacja rozmowy 1:1.", "user", "integrated",
    { subject: "Rezerwacja rozmowy {{data_spotkania}}", heading: "Rezerwacja przyjęta", lines: [hi, "Zarezerwowałeś rozmowę 1:1 na {{data_spotkania}}, godz. {{godzina_spotkania}}."] }),
  E("booking_confirmed", "rozmowy", "Potwierdzenie rezerwacji", "Rozmowa potwierdzona.", "user", "pending",
    { subject: "Rozmowa potwierdzona", heading: "Rozmowa potwierdzona", lines: [hi, "Rozmowa 1:1 odbędzie się {{data_spotkania}} o {{godzina_spotkania}}."], cta: { label: "Link do rozmowy", v: "link_do_spotkania" } }),
  E("booking_rescheduled", "rozmowy", "Zmiana terminu rozmowy", "Nowy termin rozmowy.", "user", "pending",
    { subject: "Nowy termin rozmowy", heading: "Zmiana terminu", lines: [hi, "Nowy termin rozmowy: {{data_spotkania}}, {{godzina_spotkania}}."] }),
  E("booking_cancelled", "rozmowy", "Odwołanie rozmowy", "Rozmowa odwołana.", "user", "integrated",
    { subject: "Rozmowa odwołana", heading: "Rozmowa odwołana", lines: [hi, "Rozmowa zaplanowana na {{data_spotkania}} została odwołana."] }),
  E("booking_reminder", "rozmowy", "Przypomnienie przed rozmową", "Przed zaplanowaną rozmową.", "user", "pending",
    { subject: "Przypomnienie o rozmowie", heading: "Przypomnienie", lines: [hi, "Twoja rozmowa 1:1: {{data_spotkania}}, {{godzina_spotkania}}."], cta: { label: "Link do rozmowy", v: "link_do_spotkania" } }),

  E("contact_message", "formularze", "Nowa wiadomość z formularza kontaktowego", "Powiadomienie administratora.", "admin", "integrated",
    { subject: "Nowa wiadomość: {{temat_wiadomosci}}", heading: "Nowa wiadomość z Kontaktu", lines: ["Od: {{imie}} ({{email}})", "Temat: {{temat_wiadomosci}}"], cta: { label: "Otwórz skrzynkę", v: "link_do_panelu" } }),
  E("newsletter_signup", "formularze", "Nowy zapis do newslettera", "Powiadomienie administratora.", "admin", "integrated",
    { subject: "Nowy zapis do newslettera", heading: "Nowy subskrybent", lines: ["Ktoś zapisał się do newslettera {{nazwa_platformy}}."], cta: { label: "Otwórz panel", v: "link_do_panelu" } }),
  E("consult_request_admin", "formularze", "Nowe zgłoszenie do konsultacji", "Powiadomienie administratora.", "admin", "integrated",
    { subject: "Nowe zgłoszenie: {{imie}}", heading: "Nowe zgłoszenie do konsultacji", lines: ["{{imie}} ({{email}}) zgłosił się na {{data_spotkania}}, {{godzina_spotkania}}."], cta: { label: "Otwórz panel", v: "link_do_panelu" } }),
  E("community_reply", "formularze", "Odpowiedź w Społeczności", "Odpowiedź na post użytkownika.", "user", "pending",
    { subject: "Nowa odpowiedź na Twój post", heading: "Ktoś odpowiedział", lines: [hi, "Pojawiła się odpowiedź na Twój post w Społeczności."], cta: { label: "Zaloguj się", v: "link_do_logowania" } }),
  E("report_admin_new", "formularze", "Nowe zgłoszenie moderacyjne", "Powiadomienie administratora.", "admin", "pending",
    { subject: "Nowe zgłoszenie w Społeczności", heading: "Nowe zgłoszenie", lines: ["W Społeczności zgłoszono treść do sprawdzenia."], cta: { label: "Otwórz panel", v: "link_do_panelu" } }),

  E("test_message", "system", "Wiadomość testowa", "Sprawdzenie konfiguracji wysyłki.", "user", "integrated",
    { subject: "Wiadomość testowa — {{nazwa_platformy}}", heading: "Test wysyłki", lines: [hi, "To jest wiadomość testowa z panelu {{nazwa_platformy}}."] }),
];

export const EVENTS: EventDef[] = DEFS.map((d) => d.ev);
export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.key, e]));
export const DEFAULT_TEMPLATES: Record<string, TemplateDef> = Object.fromEntries(DEFS.map((d) => [d.tpl.key, d.tpl]));

export const INTEGRATION_LABEL: Record<Integration, string> = {
  integrated: "Zintegrowane", pending: "Oczekuje na integrację", auth: "Obsługiwane przez system logowania",
};

export const sampleVars = () => Object.fromEntries(VARIABLES.map((v) => [v.key, v.sample]));
