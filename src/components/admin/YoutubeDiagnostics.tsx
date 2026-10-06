type KeyCheck = { length: number; hasWhitespace: boolean; startsAIza: boolean; lengthOk: boolean };
type Diag = { title: string; cause: string; steps: string[] };

const CONSOLE = "https://console.cloud.google.com/apis";

function diagnose(err: string): Diag {
  const e = err.toLowerCase();
  if (e.includes("brak klucza"))
    return { title: "Brak klucza API", cause: "Platforma nie ma zapisanego klucza YouTube.", steps: ["Utwórz klucz w Google Cloud (APIs & Services → Credentials → Create credentials → API key).", "Dodaj go w ustawieniach projektu jako sekret YOUTUBE_API_KEY.", "Wróć tutaj i kliknij „Zapisz i sprawdź połączenie”."] };
  if (e.includes("accessnotconfigured") || e.includes("service_disabled") || e.includes("has not been used") || e.includes("is disabled"))
    return { title: "Usługa YouTube Data API v3 jest wyłączona", cause: "Klucz istnieje, ale w jego projekcie Google Cloud nie włączono YouTube Data API v3.", steps: ["Google Cloud → APIs & Services → Library.", "Wyszukaj „YouTube Data API v3” i kliknij Enable.", "Odczekaj 2–5 minut i kliknij „Zapisz i sprawdź połączenie”."] };
  if (e.includes("referer") || e.includes("referrer") || e.includes("ip address") || e.includes("blocked"))
    return { title: "Klucz ma blokujące ograniczenia", cause: "Klucz jest ograniczony do stron WWW lub adresów IP, a zapytania wysyła serwer platformy.", steps: ["Google Cloud → APIs & Services → Credentials → kliknij klucz.", "Application restrictions: ustaw „None”.", "API restrictions: zaznacz „YouTube Data API v3” albo „Don't restrict key”.", "Zapisz, odczekaj kilka minut i sprawdź połączenie ponownie."] };
  if (e.includes("quota"))
    return { title: "Przekroczony dzienny limit zapytań", cause: "Google ogranicza liczbę zapytań na dobę.", steps: ["Poczekaj do odnowienia limitu (północ czasu pacyficznego, ok. 9:00 w Polsce).", "Ewentualnie zwiększ limit w Google Cloud → YouTube Data API v3 → Quotas."] };
  if (e.includes("api key not valid") || e.includes("api_key_invalid") || e.includes("keyinvalid") || e.includes("(400"))
    return { title: "Google odrzuca klucz jako nieprawidłowy", cause: "Klucz nie istnieje w Google Cloud, został usunięty albo skopiowano go niedokładnie.", steps: ["Google Cloud → APIs & Services → Credentials — sprawdź, czy klucz jest na liście.", "Kliknij „Show key” i skopiuj cały klucz (zaczyna się od AIza, ma 39 znaków).", "Zaktualizuj sekret YOUTUBE_API_KEY — bez spacji na początku i końcu.", "Upewnij się, że w tym samym projekcie włączono YouTube Data API v3.", "Kliknij „Zapisz i sprawdź połączenie”."] };
  if (e.includes("nie znaleziono") || e.includes("nie rozpoznano"))
    return { title: "Nie znaleziono kanału", cause: "Klucz działa, ale podany adres kanału jest błędny.", steps: ["Otwórz swój kanał na YouTube i skopiuj adres z paska przeglądarki (np. https://www.youtube.com/@nazwa).", "Wklej go powyżej i kliknij „Zapisz i sprawdź połączenie”."] };
  if (e.includes("(403"))
    return { title: "Brak uprawnień", cause: "Google odmówił dostępu dla tego klucza.", steps: ["Sprawdź, czy YouTube Data API v3 jest włączone w projekcie klucza.", "Sprawdź ograniczenia klucza (Application restrictions: None).", "Sprawdź, czy projekt Google Cloud jest aktywny."] };
  return { title: "Nieznany błąd połączenia", cause: "Google zwrócił błąd, którego nie rozpoznano automatycznie.", steps: ["Spróbuj ponownie za kilka minut.", "Jeśli błąd się powtarza, przekaż pełną treść komunikatu powyżej."] };
}

export function YoutubeDiagnostics({ error, keyConfigured, keyCheck }: { error: string | null; keyConfigured: boolean; keyCheck?: KeyCheck }) {
  const formatIssues: string[] = [];
  if (keyConfigured && keyCheck) {
    if (keyCheck.hasWhitespace) formatIssues.push("Klucz zawiera spację lub znak nowej linii — wklej go ponownie bez odstępów.");
    if (!keyCheck.startsAIza) formatIssues.push("Klucz nie zaczyna się od „AIza” — to prawdopodobnie inny rodzaj danych (np. Client ID lub hasło), a nie klucz API.");
    if (!keyCheck.lengthOk) formatIssues.push(`Klucz ma ${keyCheck.length} znaków zamiast 39 — mógł zostać ucięty przy kopiowaniu.`);
  }
  if (!error && !formatIssues.length) return null;
  const d = error ? diagnose(error) : null;
  return (
    <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Diagnostyka i instrukcja naprawy</p>
      {keyConfigured && keyCheck && (
        <ul className="space-y-1 text-xs">
          <li>{keyCheck.startsAIza ? "✓" : "✗"} Początek klucza „AIza”</li>
          <li>{keyCheck.lengthOk ? "✓" : "✗"} Długość 39 znaków</li>
          <li>{keyCheck.hasWhitespace ? "✗" : "✓"} Brak spacji</li>
        </ul>
      )}
      {formatIssues.map((f) => <p key={f} className="text-xs text-destructive">{f}</p>)}
      {d && (
        <div className="space-y-2">
          <p className="font-medium">{d.title}</p>
          <p className="text-xs text-muted-foreground">{d.cause}</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs">{d.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      )}
      <a href={CONSOLE} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-gold underline">Otwórz Google Cloud Console</a>
    </div>
  );
}
