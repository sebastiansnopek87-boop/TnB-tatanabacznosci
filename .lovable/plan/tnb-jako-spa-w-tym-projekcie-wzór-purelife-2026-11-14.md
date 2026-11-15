# TNB — uporządkowanie repozytorium i przejście do statycznego React SPA
Aktualizacja: 15.11.2026

## Stan potwierdzony

- Repozytorium produkcyjne: `sebastiansnopek87-boop/TnB-tatanabacznosci`, gałąź `main`.
- Jedyny aktywny projekt Supabase TNB: `pmdfiipontreuclfumdh`, region `eu-west-3`.
- `supabase/config.toml` wskazuje prawidłowy projekt i jawnie ustawia tryb JWT dla wszystkich sześciu aktywnych funkcji Edge.
- Źródła sześciu aktywnych funkcji Edge w repozytorium są zgodne z wdrożeniami Supabase: `tnb-health`, `tnb-users`, `tnb-platform`, `tnb-brand`, `tnb-pages`, `tnb-templates`.
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
- Odtworzyć brakującą historię SQL migracji. Obecna baza ma 64 zarejestrowane migracje, ale ich plików SQL nie ma w repozytorium. Nie generować migracji z samych nazw ani nie uruchamiać resetu bazy. Najpierw wykonać kontrolowany eksport schematu i przygotować strategię baseline bez ponownego stosowania zmian na produkcji.

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
- Dodano jawne ustawienia `verify_jwt` zgodne z sześcioma wdrożonymi funkcjami Edge.
- Moduł administracji użytkownikami korzysta teraz z `tnb-users` przez `supabase.functions.invoke`; usunięto z tej trasy `useServerFn`.
- Funkcja `tnb-users` używa nagłówków CORS z aktualnego SDK Supabase, przy zachowaniu listy dozwolonych domen. Wdrożenie: wersja 4, `verify_jwt=true`; źródło i `deno.json` porównane z GitHubem.
- Publiczny odczyt ustawień platformy przeniesiono na klienta Supabase z dokładną projekcją 28 kolumn. Zapytanie przeszło kontrolę na roli `anon`; nie odczytuje kolumn rozliczeniowych.
- Wszystkie sześć funkcji Edge i ich pliki pomocnicze porównano plik po pliku z wdrożeniami — zgodność treści potwierdzona.

## Blokady i status weryfikacji

- 64 wpisy historii migracji istnieją w Supabase, ale pliki SQL nie zostały odnalezione w GitHubie. To nadal blokuje odtwarzalność bazy z czystego środowiska.
- Nie wykonano jeszcze pełnego builda ani testów end-to-end. Próba pobrania repozytorium do lokalnego środowiska zakończyła się błędem połączenia z GitHubem; statusy CI dla ostatnich commitów są puste.
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

### Nadal otwarte przed przełączeniem do SPA

- Wciąż działa TanStack Start + Nitro; `vite.config.ts` nadal używa `@lovable.dev/vite-tanstack-config`. Nie ma jeszcze potwierdzonego statycznego buildu.
- Większość adapterów `src/lib/api/*` nadal deleguje część operacji do `*.functions.ts`. Artykuły wymagają osobnego backendowego endpointu dla zapisów, moderacji, kosza, podpisanych URL-i i obrazów publicznych.
- Trzynaście tras `src/routes/api/public/*` wymaga przeniesienia lub zastąpienia przed usunięciem serwera Start — szczególnie webhooki płatności, callback OAuth, cron i prywatne obrazy.
- Nie potwierdzono jeszcze wyniku CI dla ostatnich commitów; endpoint statusów zwraca pustą listę. Nie oznaczamy builda jako PASS.
- Migracja SQL nadal nie ma odtworzonej historii 64 migracji. Nie wolno uruchamiać resetu ani generować plików SQL z samych nazw wpisów migracji.
