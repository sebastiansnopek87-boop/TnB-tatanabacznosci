# Wdrożenie TnB React SPA na Cyberfolks

Aplikacja jest budowana jako statyczny React SPA. Produkcyjnym artefaktem jest zawartość katalogu `dist/`; hosting nie uruchamia Node, Nitro ani procesu SSR.

## 1. Konfiguracja buildu

Przed kompilacją ustaw publiczne zmienne Vite zgodne z projektem Supabase:

- `VITE_SUPABASE_URL=https://pmdfiipontreuclfumdh.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key projektu>`
- `VITE_SUPABASE_PROJECT_ID=pmdfiipontreuclfumdh`

Wartości są osadzane w plikach JavaScript w czasie kompilacji. Samo dodanie ich w panelu hostingu po wgraniu `dist/` nie zadziała — trzeba wtedy wykonać build ponownie i wysłać nowe pliki.

Użyj wersji Bun z CI i zablokowanego lockfile:

```bash
bun install --frozen-lockfile
bun run build
```

Nie dodawaj do zmiennych `VITE_*` klucza service-role, `LOVABLE_API_KEY`, `INSTAGRAM_APP_SECRET`, sekretu cron ani danych operatorów płatności. Te wartości należą wyłącznie do sekretów Supabase Edge.

## 2. Publikacja plików

1. Zrób kopię aktualnej zawartości katalogu dokumentów domeny.
2. Wgraj całą zawartość `dist/` do katalogu dokumentów domeny `tatanabacznosci.pl`.
3. Zachowaj plik `.htaccess` z katalogu `dist/`. Jest wymagany do obsługi tras SPA i odpowiedzi HTTP 410 dla wycofanych endpointów serwerowych.
4. Nie wgrywaj katalogu `src/`, `node_modules/`, `supabase/` ani plików sekretów.

Po wdrożeniu wejście bezpośrednio na adresy takie jak `/auth`, `/biblioteka`, `/artykuly` i `/spotkania` powinno zwracać `index.html`, a router React ma wyświetlić właściwy ekran.

## 3. Wymagane przełączenie cron

Przed wgraniem tej wersji przełącz harmonogramy Cyberfolks zgodnie z `docs/spa-cron-cutover.md`. Stare adresy `/api/public/cron/consult-reminders` i `/api/public/cron/instagram-sync` otrzymają HTTP 410 po publikacji.

## 4. Kontrola po wdrożeniu

Sprawdź:
- stronę główną i bezpośrednie wejście na `/auth`, `/biblioteka` i `/spotkania`;
- logowanie e-mail/hasło oraz OAuth Google i Apple (dostawcy muszą mieć prawidłowe adresy przekierowań w Supabase);
- prywatne trasy konta po zalogowaniu;
- formularz bezpłatnego materiału, potwierdzanie komentarza i rejestrację na spotkanie;
- panel administracyjny oraz wywołania Edge Functions;
- oba zadania cron i historię ich odpowiedzi HTTP.

Ta instrukcja opisuje cutover aplikacji, nie oznacza jeszcze, że zmieniono ustawienia domeny, harmonogramów Cyberfolks lub sekretów Supabase.