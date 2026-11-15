# TNB — uporządkowanie repozytorium i przejście do statycznego React SPA
Aktualizacja: 15.11.2026

## Stan potwierdzony

- Repozytorium produkcyjne: `sebastiansnopek87-boop/TnB-tatanabacznosci`, gałąź `main`.
- Jedyny aktywny projekt Supabase TNB: `pmdfiipontreuclfumdh`, region `eu-west-3`.
- `supabase/config.toml` wskazuje prawidłowy projekt i jawnie ustawia tryb JWT dla wszystkich jedenastu aktywnych funkcji Edge.
- Źródła jedenastu aktywnych funkcji Edge w repozytorium są zgodne z wdrożeniami Supabase: `tnb-health`, `tnb-users`, `tnb-platform`, `tnb-brand`, `tnb-pages`, `tnb-templates`, `tnb-assets`, `tnb-contact`, `tnb-articles`, `tnb-media`, `tnb-avatar`.
- Typy `src/integrations/supabase/types.ts` odpowiadają typom wygenerowanym z bieżącej bazy (PostgREST 14.18).
- Frontend nadal korzysta z TanStack Start, TanStack Router i Nitro. Wygenerowane drzewo tras obejmuje 72 trasy.
- `public/.htaccess` i skrypt `scripts/scan-dist-secrets.sh` już istnieją.
- Zablokowanie Lovable w konektorach nie usuwa zależności z kodu: konfiguracja Vite nadal pochodzi z `@lovable.dev/vite-tanstack-config`.

## Ważna zmiana kolejności

Nie wolno przełączyć projektu na statyczne SPA przed przeniesieniem wszystkich używanych `createServerFn` i tras `api/*`. Statyczny hosting FTP nie uruchomi serwera TanStack Start. Dlatego przenoszenie backendu musi wyprzedzić usunięcie TanStack Start. Nie tworzyć atrap funkcji i nie zastępować operacji administracyjnych zapytaniami z przeglądarki.

## Etapy

### 0. Jedno źródło prawdy
- Repozytorium GitHub jest kanonicznym źródłem kodu frontendowego, funkcji Edge i konfiguracji.
- Supabase jest środowiskiem wykonawczym bazy i Edge Functions; wszystkie wdrożone źródła muszą mieć odpowiedniki w GitHubie.
- Konfiguracja CLI musi wskazywać dokładnie projekt `pmdfiipontreuclfumdh`.
- Utrzymywać odtwarzalną historię migracji: repozytorium i aktywna baza mają obecnie 65 migracji (`0000`–`0064`); pliki SQL są w `drizzle/migrations/`, journal ma 65 wpisów, a snapshoty muszą zachować ciągłość `prevId`. Migracje zostały odzyskane z wiarygodnego źródła; nie uruchamiać ich ponownie na produkcji ani nie wykonywać resetu bazy.

### 1. Migracja backendu domenami — przy działającym TanStack Start
- Przenosić operacje `createServerFn` do istniejących lub nowych Edge Functions, domena po domenie.
- Frontend wywołuje je przez `supabase.functions.invoke`; bezpieczne, publiczne odczyty mogą używać bezpośredniego Supabase JS tylko wtedy, gdy zakres kolumn, GRANT i RLS są zweryfikowane.
- Każda operacja administracyjna weryfikuje token po stronie serwera, rolę przez bazę i zapisuje wymagane zdarzenia. Sekrety i service role pozostają wyłącznie po stronie Edge.
- Zachować walidację danych, ograniczenia ról, atomową ochronę ostatniego superadministratora, logowanie zdarzeń i wykluczanie zamówień testowych.
- Po każdej domenie porównać kontrakty wejścia/wyjścia, sprawdzić CORS/JWT i wykonać testy funkcji.

### 2. Migracja tras serwerowych
- Przenieść wszystkie trasy `api/public/*` do Edge Functions lub odpowiednich usług Supabase.
- Webhooki płatności muszą weryfikować podpis operatora przed zmianą zamówienia.
- Callback OAuth, cron, synchronizacje i proxy plików muszą zachować dotychczasowe zabezpieczenia, limity i obsługę błędów.
- Nie publikować sekretów dostawców ani service-role w kodzie frontendowym.

### 3. Przebudowa frontendowa do statycznego React SPA
Dopiero po zakończeniu etapów 1–2:
- Zachować `@tanstack/react-router`, istniejące pliki `src/routes/*` i generowane `src/routeTree.gen.ts`. Nie przepisywać 72 tras na React Router bez wykazanego problemu technicznego.
- Usunąć `@tanstack/react-start`, Nitro i `@lovable.dev/vite-tanstack-config`; przejść na standardowy Vite z `@tanstack/router-plugin/vite` (przed `@vitejs/plugin-react`), `@tailwindcss/vite` i `vite-tsconfig-paths`.
- Dodać `index.html` i wejście `src/main.tsx`, które tworzy router z `src/router.tsx` i montuje `RouterProvider`.
- W `src/routes/__root.tsx` usunąć Start-owy `shellComponent` i powłokę serwerową; zachować `HeadContent`, `Scripts`, QueryClientProvider, globalny layout, 404 i obsługę błędów w wersji klientowej.
- Zachować 72 adresy, parametry, query, guardy logowania/admina, metadane SEO i wygląd istniejących komponentów.
- Potwierdzić, że po migracji nie ma importów z `@tanstack/react-start`, `createServerFn`, `useServerFn`, `client.server` ani tras API wymagających Node.
- Dokumentacja: [TanStack Router — Vite](https://tanstack.com/router/latest/docs/installation/with-vite) oraz [Document Head Management — SPA](https://tanstack.com/router/latest/docs/guide/document-head-management).

### 4. Build i Cyberfolks
- Używać `bun.lock` jako lockfile; nie generować równoległego `package-lock.json`.
- Dodać CI dla `bun install --frozen-lockfile`, lint/build i skanu `dist`.
- Zbudować statyczny `dist/`, sprawdzić brak sekretów oraz ścieżki głębokie po odświeżeniu.
- Skonfigurować na Cyberfolks zmienne `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`; żadna zmienna sekretna nie może mieć prefiksu `VITE_`.
- Zweryfikować hosting na domenie produkcyjnej: logowanie, reset hasła, OAuth, panel administracyjny, role, publiczne strony, uploady i krytyczne ścieżki.
- Płatności i pocztę testować najpierw w trybach testowych; bez testowych transakcji na prawdziwych klientach.

## Prace wykonane 15.11.2026

- Naprawiono `project_id` w `supabase/config.toml` na `pmdfiipontreuclfumdh`.
- Dodano jawne ustawienia `verify_jwt` dla wszystkich jedenastu aktywnych usług Edge: health, users, platform, brand, pages, templates, assets, contact, articles, media i avatar.
- Moduł administracji użytkownikami korzysta teraz z `tnb-users` przez `supabase.functions.invoke`; usunięto z tej trasy `useServerFn`.
- Funkcja `tnb-users` używa nagłówków CORS z aktualnego SDK Supabase, przy zachowaniu listy dozwolonych domen. Wdrożenie: wersja 4, `verify_jwt=true`; źródło i `deno.json` porównane z GitHubem.
- Publiczny odczyt ustawień platformy przeniesiono na klienta Supabase z dokładną projekcją 28 kolumn. Zapytanie przeszło kontrolę na roli `anon`; nie odczytuje kolumn rozliczeniowych.
- Wszystkie jedenaście aktywnych funkcji Edge i ich pliki pomocnicze porównano z wdrożeniami; zgodność treści potwierdzono.

## Blokady i status weryfikacji

- Repozytorium zawiera 65 plików SQL i 65 wpisów journalu, zgodnych kolejnością z 65 migracjami zastosowanymi w Supabase. Snapshoty 0000–0063 są obecne; snapshot 0064 jest uzupełniany w tej iteracji.
- Produkcyjny build aplikacji przechodzi w CI. Testy end-to-end i rzeczywista weryfikacja przepływów po zalogowaniu nadal nie zostały wykonane.
- Nie wdrażano statycznego frontendu na Cyberfolks. Aplikacja nadal wymaga serwera TanStack Start w nieprzeniesionych obszarach.

## Zasady bezpieczeństwa

- Żadnych sekretów w przeglądarce ani w zmiennych `VITE_*`.
- Nie usuwać polityk RLS, uprawnień ani indeksów bez analizy zależności i testu.
- Ostatni superadministrator musi pozostać chroniony atomowo w bazie.
- Zamówienia testowe pozostają wyłączone ze statystyk przychodów.
- Bez resetu bazy, zmian produkcyjnych płatności ani wysyłki realnej poczty bez uzasadnionego testu i osobnej akceptacji.


### Dalszy postęp — 15.11.2026, kontynuacja

- Uzupełniono brakujące źródła wdrożonych funkcji: `tnb-pages/deno.json`, `tnb-pages/_shared/rich-text.ts` oraz komplet `tnb-templates` (`index.ts`, `deno.json`, dwa pliki `_shared`). Dodane pliki porównano bajt w bajt z aktywnymi wdrożeniami Supabase.
- Moduł marki korzysta z `tnb-brand` przez `supabase.functions.invoke`; upload, finalizacja i zapis ustawień nie wymagają już `useServerFn`. Favicon, obraz Open Graph i podglądy w panelu korzystają z publicznego GET funkcji `tnb-brand`.
- CMS stron i Visual Builder korzystają z `tnb-pages`; szablony Visual Buildera korzystają z `tnb-templates`. Publiczne obrazy stron są adresowane przez GET `tnb-pages?image=...`.
- W artykułach przeniesiono odczyt pojedynczego rekordu i walidację dostępności slugu do klienta Supabase. Przed zmianą sprawdzono aktywne polityki: odczyt wszystkich kolumn tabeli `articles` dla roli `authenticated` jest ograniczony RLS do `has_role(auth.uid(),'admin')`. Zapisy, kosz, moderacja, uploady i log audytowy nadal wymagają backendu.
- Usunięto nieużywany, śledzony plik `.env.development` z tokenem, którego nie znaleziono w użyciu w kodzie. `.env` jest wykluczony z repo, a `.env.example` zawiera publiczne ustawienia połączenia z aktywnym projektem TNB i placeholder klucza.
- Nie wykonano zmian tabel, polityk RLS ani danych produkcyjnych.

### Kontynuacja prac — 15.11.2026, dalszy ciąg

- Ujednolicono nagłówki CORS z aktualnego SDK Supabase w ośmiu funkcjach Edge. Zachowano metody HTTP, listy originów lub publiczny wildcard zgodnie z przeznaczeniem każdej funkcji.
- Uruchomiono nową publiczną funkcję `tnb-contact` (v5, `verify_jwt=false`). Formularz kontaktowy wywołuje ją przez `supabase.functions.invoke`; trasa `/kontakt` nie używa już `useServerFn`. Walidacja pól, honeypot i minimalny czas wypełniania są sprawdzane po stronie Edge. Zachowano zapis `contact_messages` oraz idempotentny dziennik powiadomienia w trybie testowym; nie wysyła się prawdziwej poczty, bo adapter dostawcy pozostaje niepodłączony.
- Zsynchronizowano `tnb-assets` z wdrożonym źródłem, które obsługuje również obrazy artykułów. Wdrożenie jest aktywne jako v4.
- Artykuły korzystają teraz z `publicArticleAssetUrl`, który kieruje obrazy przez `tnb-assets?kind=article...` i zachowuje stary endpoint jako fallback dla środowiska bez `VITE_SUPABASE_URL`. Publiczne okładki biblioteki, spotkań i podcastu już korzystają z tego samego Edge Function.
- Potwierdzono zgodność kodu i plików pomocniczych aktywnych Edge Functions z GitHubem; lista została rozszerzona o artykuły, media i avatary. Bieżący wykaz znajduje się w najnowszym addendum poniżej.
- CI kontroluje instalację z `bun.lock`, build, skan katalogu wyjściowego i lint zmienionych plików. Pełny przebieg zakończył się sukcesem na commicie `04c78872fabef9bbded0b224360c3df61b54d015`.

### Nadal otwarte przed przełączeniem do SPA

- Wciąż działa TanStack Start + Nitro; `vite.config.ts` nadal używa `@lovable.dev/vite-tanstack-config`. Nie ma jeszcze potwierdzonego statycznego buildu.
- W `src/lib/api/*` istnieje 26 adapterów; część jest już bezpośrednio połączona z Supabase lub Edge Functions, pozostałe nadal wymagają migracji z `*.functions.ts`. Operacje artykułów są już obsługiwane przez `tnb-articles`.
- Trzynaście tras `src/routes/api/public/*` wymaga przeniesienia lub zastąpienia przed usunięciem serwera Start — szczególnie webhooki płatności, callback OAuth, cron i prywatne obrazy.
- Build, skan artefaktów i lint zmienionych plików przechodzą w CI; potwierdzenie: run `43757512670`, commit `04c7887`. Nie oznacza to jeszcze gotowości SPA ani testów E2E.
- Historia 65 migracji SQL jest odtworzona w GitHubie; nie uruchamiać migracji ponownie na produkcji. Utrzymywać komplet snapshotów Drizzle i porównywać journal z bazą.

### Stan po kolejnej iteracji — 15.11.2026, 20:20

- W Supabase działa 11 funkcji Edge: `tnb-health`, `tnb-users`, `tnb-platform`, `tnb-brand`, `tnb-pages`, `tnb-templates`, `tnb-assets`, `tnb-contact`, `tnb-articles`, `tnb-media`, `tnb-avatar`. Źródła wszystkich 11 funkcji i ich manifesty zależności są obecne w GitHubie; zgodność wdrożonych plików została sprawdzona dla funkcji migracyjnych.
- `tnb-media` odpowiada za kontrolowany odczyt obrazów i avatarów. `tnb-avatar` obsługuje zapis i usuwanie avatara, wymaga JWT i waliduje WebP po stronie serwera. `UserAvatar` pobiera obraz z tokenem użytkownika, a `AvatarEditor` wywołuje funkcję bezpośrednio przez adapter API.
- Administracyjny widok artykułów korzysta bezpośrednio z adaptera `src/lib/api/articles.ts`; wywołania Edge Function nie są już opakowane przez `useServerFn` w tym widoku.
- Naprawiono skan sekretów: rozpoznaje rzeczywiste wzorce kluczy Supabase/Google, JWT z rolą `service_role` i jawne odwołania do sekretów serwerowych. Raport nie wypisuje wartości sekretów. Wcześniejsze trafienia `YOUTUBE_API_KEY` i samego prefiksu `sb_secret_` były nazwami/prefiksami w kodzie, nie wartościami kluczy.
- CI dla `main` na commicie `04c78872fabef9bbded0b224360c3df61b54d015` zakończyło się sukcesem: build, skan publicznego outputu i lint zmienionych plików.
- Aktualny audyt drzewa repozytorium: 26 adapterów `src/lib/api/*.ts`, 25 modułów `src/lib/*.functions.ts` i 13 tras `src/routes/api/*`. W repo nadal nie ma `index.html` ani `src/main.tsx`; aplikacja nie została jeszcze przełączona na SPA.
- Nadal trzeba przenieść pozostałe operacje serwerowe (m.in. podcast/YouTube, płatności, dostarczanie plików, OAuth i cron), usunąć lub zastąpić trasy API po potwierdzeniu braku zależności i przygotować czysty statyczny build. Historia 65 migracji SQL została odtworzona z wiarygodnego źródła; brakujący snapshot 0064 jest dodawany osobno.
- Nie zmieniano schematu, polityk RLS ani danych produkcyjnych. Nie przełączano hostingu Cyberfolks na katalog statyczny.
