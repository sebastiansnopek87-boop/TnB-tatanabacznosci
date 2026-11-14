# Migracja TanStack Start -> React SPA (Vite, CSR, statyczny dist/)

Plan techniczny. Nic nie zostało zmienione. Inwentaryzacja liczbowa: 72 trasy, 13 tras API, 28 modułów `.functions.ts` z 217 funkcjami serwerowymi, 8 modułów `.server.ts`, 41 plików z kluczem service role, 0 funkcji brzegowych (pełna lista: plan z 14.11 i plik TNB-Etap1-mapa-tras.md).

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

## 3. Backend — stan faktyczny i BLOCKER główny
- Sprawdzone 14.11: próba utworzenia funkcji brzegowej w tym projekcie została **zablokowana przez platformę** ("new Supabase Edge Functions are not created here" — projekt rozpoznany jako TanStack Start). Funkcji brzegowych: 0.
- **BLOCKER B0**: bez możliwości utworzenia funkcji brzegowych nie istnieje bezpieczne miejsce dla 217 operacji. Do ustalenia: czy blokada znika po usunięciu TanStack Start (niezweryfikowane — może wymagać potwierdzenia przez Lovable). Do tego czasu frontend NIE może zostać przełączony, bo funkcje by zniknęły.
- Sekrety: funkcje brzegowe Lovable Cloud czytają te same sekrety projektu (SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY, YOUTUBE_API_KEY, LOVABLE_CRON_SECRET; dodawane: INSTAGRAM_*, klucze operatorów, PUBLIC_SITE_URL). Klucz service role nigdy nie trafia do przeglądarki.

## 4. Mapa modułów -> docelowe wywołanie
Wszystkie funkcje backendowe: weryfikacja JWT (`auth.getUser`), role przez `has_role`, `logEvent` do `admin_events`, walidacja zod identyczna jak dziś, odpowiedzi bez szczegółów błędów.
| Moduł (obecny) | Docelowo | Z przeglądarki przez RLS? | Status |
|---|---|---|---|
| users, admin, admin-auth (role, ostatni superadmin) | funkcja `admin-users` | nie | czeka na B0 |
| platform, brand (billing_*) | `platform-settings`; publiczne kolumny bezpośrednio z przeglądarki | odczyt publiczny tak, reszta nie | czeka na B0 |
| control-center | `control-center` (tylko odczyt) | nie | B0 |
| orders(.server), payments, zakup.$token | `orders`, `payments-admin` | nie | B0 |
| webhooki p24/payu/tpay | `pay-webhook` (weryfikacja podpisu, dedup, kwota) | nie | B0 + C |
| library, library-delivery, pdf.server (znak wodny) | `library-delivery` (podpisane URL-e) | metadane tak, pliki nie | B0 |
| 7 tras obrazów `/api/public/*` | `media-public` (te same kontrole), adresy obrazów zmienione na adres funkcji | nie | B0 |
| pages, templates, articles, Visual Builder, zatwierdzanie prawne (SHA-256) | `cms` | publiczne odczyty tak | B0 |
| guest-comments, newsletter, article-newsletter, contact | `public-forms`, `newsletter` | nie | B0 |
| meetings, consult, meetings-notify | `meetings`, `consult` | publiczne listy tak | B0 |
| notifications(.server/-test), dispatch | `notifications` (tryb test bez zmian) | nie | B0 |
| editor-ai, editor-materials (AI Gateway) | `ai-editor` | nie | B0 |
| voice, podcast, youtube.server | `media-sync`, `podcast` | publiczne listy tak | B0 |
| instagram.server, callback OAuth | `instagram` + `instagram-callback` | nie | B0 + C |
| cron consult-reminders, instagram-sync | `cron-*` wywoływane harmonogramem backendu z LOVABLE_CRON_SECRET | nie | B0 |
| avatar, media, recommend | `avatars`, `media-admin`, `recommend` | częściowo | B0 |
| Społeczność, reakcje, tożsamość TNB | bez zmian — już bezpośrednio przez RLS/RPC | tak | gotowe |

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
1. Warstwa `src/lib/api/*` delegująca do obecnych server fn; UI przełączone na nią. Aplikacja działa jak dziś. Rollback: przywrócenie wersji z historii.
2. Backend: funkcje wg tabeli 4, równolegle do obecnych (nic nie wyłączone). Każda porównana z obecną (te same dane).
3. Przełączenie `src/lib/api/*` na funkcje backendowe moduł po module.
4. Frontend SPA: `index.html`, `main.tsx`, `vite.config.ts`, root bez SSR.
5. Usunięcie Start/Nitro, tras API, modułów serwerowych.
6. Testy z punktu 7, paczka `dist/` + `.htaccess`.
7. Konfiguracja zewnętrzna (C), akceptacja.

## Podział
**A. Pierwszy BUILD (możliwy teraz, bez ryzyka):** etap 1 — warstwa `src/lib/api/*` i przełączenie importów UI; przygotowanie `.htaccess` i skryptu skanu `dist/`. Bez zmian zachowania.
**B. Odrębny etap backendowy:** etapy 2–3 i 5 — wymagają zdjęcia blokady B0 (możliwości tworzenia funkcji brzegowych). Bez tego migracja nie może zostać zakończona bez utraty funkcji.
**C. Po stronie właściciela usług:** własne klucze Google/Apple (B1) i ich adresy powrotu; adresy webhooków w P24/Tpay/PayU; adres callbacku w Meta (Instagram); adresy powrotu logowania dla `tatanabacznosci.pl`; DNS i upload `dist/` w Cyberfolks.

Migracja nie jest gotowa — to wyłącznie plan.
