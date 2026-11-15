Plan techniczny migracji do statycznego React SPA (Vite, CSR, dist/) i uporządkowania źródeł.

**Stan zweryfikowany: 15.11.2026.** Źródłem kodu jest repozytorium `sebastiansnopek87-boop/TnB-tatanabacznosci`, gałąź `main`. Źródłem działającego backendu jest Supabase `pmdfiipontreuclfumdh`. Nie używać repozytorium `purelifecenter` jako źródła dla TNB.

- W Supabase działa 6 Edge Functions: `tnb-health`, `tnb-users`, `tnb-platform`, `tnb-brand`, `tnb-pages`, `tnb-templates`. Ich aktywne wersje i pliki źródłowe zostały porównane z repozytorium; treść plików jest zgodna.
- Repozytorium zawiera `supabase/config.toml`, kompletne katalogi źródłowe tych funkcji i wspólne pliki zależności. Migracje bazy są śledzone w `drizzle/migrations`; Supabase raportuje zastosowanie migracji do `0064_community_post_visible_authenticated`.
- Bezpośrednie adaptery przeglądarkowe są wdrożone dla `users`, `platform`, `brand`, `pages` i `templates`. Część operacji platformy (np. publiczny odczyt ustawień) korzysta bezpośrednio z kontrolowanego RLS/column grants.
- Pozostałe moduły nadal korzystają z funkcji TanStack Start. Aplikacja **nie jest jeszcze statycznym React SPA**.
- `.htaccess` i `scripts/scan-dist-secrets.sh` istnieją. Nie ma jeszcze gotowego, zaakceptowanego `dist/` do hostingu Cyberfolks.
- CI: ostatni znany błąd składni w adapterze CMS i adresie obrazów został poprawiony. Najnowsze uruchomienie Build zakończyło się jako `cancelled`, więc po tych poprawkach nie ma potwierdzonego zielonego builda.

Liczby z inwentaryzacji 14.11 (72 trasy, 13 tras API, 28 modułów `.functions.ts`, 217 funkcji serwerowych i 8 modułów `.server.ts`) są punktem bazowym audytu, a nie potwierdzeniem aktualnej liczby po migracji.
## 1. Wybór routera: TanStack Router (samodzielny), nie React Router
| Kryterium | TanStack Router standalone | React Router |
|---|---|---|
| Działa bez Start, czysto w przeglądarce | tak (`@tanstack/react-router` + `@tanstack/router-plugin/vite`) | tak |
| Zmiany w 103 plikach z `Link/useNavigate/useSearch/validateSearch` | brak | przepisanie wszystkich |
| Zachowanie URL, parametrów `$slug`, walidowanych query (`dostep/format/kategoria/sort/q`, `record`) | 1:1 | ręczna re-implementacja |
| Ryzyko regresji | niskie | wysokie |
Decyzja: TanStack Router w trybie SPA. Usuwany jest wyłącznie TanStack Start.

## 2. Frontend — pliki
Dodać: `index.html`, `src/main.tsx` (createRoot + RouterProvider + QueryClientProvider), `public/.htaccess`, `src/lib/api/*.ts` (warstwa wywołań backendu, jedna na moduł).
Zmienić: `vite.config.ts` (`@vitejs/plugin-react`, `@tailwindcss/vite`, `tanstackRouter({ autoCodeSplitting: true })`, `vite-tsconfig-paths`; bez `@lovable.dev/vite-tanstack-config`), `package.json` (`build: vite build`), `src/router.tsx`, `src/routes/__root.tsx` (bez `shellComponent`/`HeadContent`/`Scripts`; tytuły i meta przez `useHead`-zamiennik ustawiający `document.title`/meta), `_authenticated/route.tsx` (ten sam `beforeLoad` getUser -> `/auth`, bez `ssr:false`), 11 tras z loaderami (wywołują `src/lib/api/*` zamiast server fn), wszystkie komponenty importujące `*.functions.ts` (przełączenie importu na `src/lib/api/*`, ten sam kształt danych).
Usunąć (dopiero po etapie backendowym): `src/server.ts`, `src/start.ts`, `src/routes/api/**`, `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/lib/**/*.server.ts`, `src/integrations/supabase/client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`; pakiety `@tanstack/react-start`, `nitro`, `@lovable.dev/vite-tanstack-config`.
Zachować: `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/zod-adapter`, `@tanstack/react-query`, `zod`, wszystkie komponenty UI, `styles.css`, `client.ts`, `types.ts`, `supabase/migrations`, `db-proposals/`.
404: `notFoundComponent` w root (jak dziś). Fallback hostingu (`.htaccess`):
```text
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```
Lockfile: `bun.lock`, instalacja `bun install --frozen-lockfile`.

## 3. Backend — stan faktyczny (BLOCKER B0 zamknięty)

- Wcześniejsza blokada tworzenia Edge Functions już nie obowiązuje. W projekcie Supabase TNB działają funkcje brzegowe i są wdrożone.
- Aktywne funkcje i polityka JWT:
  - `tnb-health` — `verify_jwt = true`
  - `tnb-users` — `verify_jwt = true`
  - `tnb-platform` — `verify_jwt = true`
  - `tnb-brand` — `verify_jwt = false`; funkcja realizuje własną weryfikację sesji dla operacji chronionych
  - `tnb-pages` — `verify_jwt = false`; odczyt publiczny jest jawnie oddzielony od operacji administratora
  - `tnb-templates` — `verify_jwt = false`; operacje administracyjne wymagają sesji i roli
- Wszystkie powyższe funkcje mają zapisane w GitHubie pliki `index.ts`, `deno.json` i zależności współdzielone; porównanie treści z wdrożonymi wersjami Supabase zakończyło się zgodnością.
- Klucz service role pozostaje wyłącznie po stronie Edge Functions/serwera. Nie wolno przenosić go do `VITE_*`, kodu klienta ani paczki `dist/`.
- Nie wolno usuwać TanStack Start, tras API ani modułów `.server.ts`, dopóki wszystkie zależne operacje nie mają kompletnego odpowiednika backendowego i testów regresji.
- Zmiany schematu bazy wykonujemy przez kontrolowane migracje zapisane w repozytorium. Nie uznajemy ręcznej zmiany w Supabase za odtwarzalną, dopóki jej SQL i wpis w historii migracji nie są w GitHubie.

**Wniosek:** B0 nie blokuje już pracy. Aktualnym ograniczeniem jest niepełne przeniesienie operacji serwerowych do Edge Functions oraz brak zakończonej migracji frontendu do CSR.
## 4. Mapa modułów -> docelowe wywołanie

| Moduł | Docelowe wywołanie / architektura | Stan na 15.11.2026 |
|---|---|---|
| Użytkownicy (lista, szczegóły, role) | `tnb-users` | wdrożone i podłączone przez `src/lib/api/users.ts`; pozostałe operacje admin/auth wciąż wymagają audytu |
| Ustawienia platformy | `tnb-platform`; publiczne, jawnie dozwolone kolumny bezpośrednio przez RLS | wdrożone i podłączone przez `src/lib/api/platform.ts` |
| Marka / logo / favicon | `tnb-brand` | wdrożone i podłączone przez `src/lib/api/brand.ts` |
| CMS stron, publikacja prawna, historia i obrazy | `tnb-pages` | wdrożone i podłączone przez `src/lib/api/pages.ts`; publiczne obrazy są serwowane przez Edge Function |
| Szablony Visual Buildera | `tnb-templates` | wdrożone i podłączone przez `src/lib/api/templates.ts` |
| Control Center | osobna funkcja read-only | nadal TanStack Start |
| Artykuły, ankiety i moderacja komentarzy | `articles` / CMS artykułów | nadal TanStack Start |
| Zamówienia i płatności | `orders`, `payments-admin` | nadal TanStack Start; nie zmieniać bez osobnego testu przepływów płatniczych |
| Webhooki P24/Tpay/PayU | odrębne endpointy z weryfikacją podpisu, kwoty i idempotencji | nadal trasy serwerowe; wymagają osobnego testu z dostawcami |
| Biblioteka, dostarczanie plików i PDF/znak wodny | `library-delivery` | nadal TanStack Start |
| Obrazy publiczne (artykuły, avatary, podcast, biblioteka, spotkania, marka, CMS) | funkcje public-media z kontrolą publikacji i uprawnień | tylko obrazy CMS są już obsłużone przez `tnb-pages`; pozostałe trasy API pozostają |
| Formularze: kontakt, newsletter, komentarze | `public-forms`, `newsletter` | nadal TanStack Start |
| Spotkania i konsultacje | `meetings`, `consult` | nadal TanStack Start |
| Powiadomienia i wysyłka e-mail | `notifications` | nadal TanStack Start; zachować tryb testowy i logowanie dostaw |
| Edytor AI i materiały | `ai-editor` | nadal TanStack Start; AI tylko po autoryzowanym wywołaniu backendowym |
| Podcast, YouTube i Instagram | `podcast`, `media-sync`, `instagram` | nadal TanStack Start / callbacki serwerowe |
| Cron: konsultacje, synchronizacja Instagram | funkcje Edge uruchamiane harmonogramem backendu | nadal trasy serwerowe; wymagają migracji i testu sekretu cron |
| Avatary, multimedia i rekomendacje | `avatars`, `media-admin`, `recommend` | nadal TanStack Start |
| Społeczność, reakcje i tożsamość TNB | bezpośrednio przez RLS/RPC | istniejący model zachowany; migracja 0064 ogranicza `community_post_visible(uuid)` do `authenticated` i `service_role` |

Każda nowa funkcja backendowa ma mieć: walidację Zod, weryfikację użytkownika i roli dla operacji chronionych, logowanie istotnych zdarzeń, bezpieczne komunikaty błędów oraz testy pozytywne i negatywne.
## 5. Auth i sesje
- E-mail/hasło, aktywacja, reset hasła: bez zmian (przeglądarka). Adresy powrotu na `https://tatanabacznosci.pl/auth` i `/reset-password` muszą być na liście dozwolonych (C).
- Sesja w localStorage, jeden `useAuth()`: bez zmian. Guard `_authenticated` bez zmian logicznych.
- Google/Apple: broker Lovable działa tylko na hostingu Lovable -> **BLOCKER B1**: przejście na natywne OAuth backendu z własnymi kluczami właściciela (wybrane). Kod: `supabase.auth.signInWithOAuth` zamiast `lovable.auth...`; usunąć `@lovable.dev/cloud-auth-js` dopiero po teście.
- RLS i schemat: bez zmian.

## 6. Zależności od Lovable
Podgląd Lovable po usunięciu Start: niezweryfikowane (ryzyko R1). AI Gateway: tylko z backendu. Wstrzykiwane `VITE_SUPABASE_*`: muszą być wpisane do builda lokalnego (publiczne). Sekrety serwerowe w Lovable Cloud.

## 7. Testy akceptacyjne
- Każda z 72 tras: wejście bezpośrednie i odświeżenie na `vite preview` oraz Apache; 404 dla nieznanego URL.
- Logowanie, rejestracja, reset, Google/Apple; dostęp admin vs moderator vs gość; ochrona ostatniego superadmina.
- Zamówienie testowe (is_test poza statystykami), odrzucenie przelewu bez rachunku, webhook z błędnym podpisem odrzucony.
- Pobranie PDF z dostępem i bez; obrazy prywatne widoczne tylko gdy opublikowane.
- CMS: szkic/publikacja, zatwierdzenie prawne konkretnej wersji.
- Powiadomienia w trybie test zapisują log; AI tylko po kliknięciu superadmina.
- Istniejące testy Vitest (control-center 19, pages 40, platform 6, legal 28, podcast 8) przeniesione na nowe funkcje.
- Skan `dist/`: brak `service_role`, wartości sekretów, `client.server`, `LOVABLE_API_KEY`, kluczy operatorów; dozwolony tylko klucz publiczny.

## 8. Etapy i rollback

1. **Warstwa API — częściowo wykonana.** Katalog `src/lib/api/*` istnieje, ale część modułów jest jedynie fasadą eksportującą stare funkcje Start. Nie uznawać samej obecności adaptera za migrację backendu.
2. **Backend Edge Functions — częściowo wykonany.** Aktywne i zsynchronizowane są: users, platform, brand, pages, templates oraz health. Pozostałe domeny migrować oddzielnie, z równoległym zachowaniem dotychczasowego kodu do czasu testów.
3. **Przełączenie UI — częściowo wykonane.** Bezpośrednio podłączone są adaptery users, platform, brand, pages i templates. Każdy następny moduł wymaga sprawdzenia kontraktu oraz wszystkich wywołań UI, loaderów i akcji.
4. **Frontend SPA — nierozpoczęty.** Dodać `index.html` i `src/main.tsx`; uruchomić samodzielny TanStack Router z `createRoot` i bez SSR. Zachować URL-e, guard auth i QueryClient.
5. **Usunięcie Start/Nitro — zablokowane do czasu zakończenia backendu.** Dopiero po migracji wszystkich operacji i tras API usunąć `@tanstack/react-start`, Nitro, moduły `.server.ts`, server functions i adaptery specyficzne dla Start.
6. **Akceptacja produkcyjna.** Build CI musi mieć status PASS. Sprawdzić wszystkie trasy bezpośrednio i po odświeżeniu, logowanie, role, CMS, pliki prywatne, PDF, płatności, webhooki i zadania cron. Uruchomić skan `dist/` — bez service role, sekretów, prywatnych kluczy i kodu serwerowego. Wynik: wyłącznie statyczny `dist/` + `.htaccess`.
7. **Wdrożenie Cyberfolks.** Dopiero po akceptacji paczki ustawić domenę, konfigurację OAuth, adresy webhooków/callbacków i sekrety, a następnie wgrać `dist/`. Nie traktować obecnego repo jako gotowego artefaktu produkcyjnego.

Rollback każdego modułu: przywrócenie poprzedniego adaptera i UI z osobnego commita, bez kasowania starej funkcji serwerowej przed zakończeniem testów. Zmiany w bazie wycofywać osobną migracją naprawczą, nie przez ręczne cofanie historii.

## Podział dalszych prac

**A. Zamknięte:** utworzenie i zapis źródeł sześciu Edge Functions, synchronizacja ich plików z Supabase, konfiguracja JWT, migracje 0059–0064 w historii repozytorium oraz przełączenie adapterów users/platform/brand/pages/templates.

**B. Najbliższe:** potwierdzić zielony build CI po poprawkach składni i CORS; następnie migrować backend modułami o jasno określonym kontrakcie. Priorytet: artykuły, biblioteka/dostarczanie plików, spotkania i formularze. Płatności/webhooki migrować jako osobny etap z testami podpisu i idempotencji.

**C. Przed SPA i Cyberfolks:** usunąć zależność od Lovable w OAuth (własne klucze Google/Apple i adresy powrotu), potwierdzić wszystkie zewnętrzne callbacki i webhooki, a potem wykonać pełny test CSR na `vite preview` i Apache.

**Status końcowy:** aplikacja pozostaje na TanStack Start/Nitro. Nie jest jeszcze gotowym React SPA i nie należy wdrażać jej na Cyberfolks przez samo skopiowanie obecnego `dist/`.