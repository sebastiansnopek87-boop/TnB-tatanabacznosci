# Plan migracji: TanStack Start -> React SPA (Vite + React Router), backend bez zmian

Dokument wyłącznie analityczny. Nic nie zostało zmienione.

## A. Werdykt
Migracja jest **możliwa** przy zachowaniu obecnej bazy, kont i plików, ale to **zmiana duża**. Cała logika serwerowa (dziś wewnątrz aplikacji) musi zostać przeniesiona do funkcji backendowych Lovable Cloud (funkcje brzegowe), bo strona statyczna nie może trzymać sekretów. Klucz service role pozostaje wyłącznie w backendzie. W projekcie nie ma dziś żadnej funkcji brzegowej — wszystkie trzeba utworzyć.

## B. Inwentaryzacja (stan zmierzony)
- 72 pliki tras; 30 chronionych (`_authenticated/*`: 26 ekranów admina, `moje-tnb`, `ustawienia-konta`, layouty `admin.tsx`, `route.tsx`).
- Publiczne: `/`, artykuly (lista, `$slug`), biblioteka (lista, `$slug`, `pobierz`), podcast (lista, `$slug`), spotkania (lista, `$slug`, `rezerwacja.$token`, `zgloszenie.$token`, `rozmowa-1-1`), spolecznosc (lista, `$postId`), strony.`$slug`, zakup.`$token`, auth, reset-password, kontakt, o-tnb, moja-historia, materialy-premium, newsletter.wypisz, komentarz.potwierdz, 3 strony prawne.
- 13 tras API `/api/public/*`: 7 serwujących obrazy z prywatnych zasobów (article-image, avatar, brand, library-cover, meeting-image, page-image, podcast-cover), 3 webhooki płatności (p24, payu, tpay), callback Instagram, 2 crony (consult-reminders, instagram-sync).
- 28 modułów z `createServerFn`, łącznie **217 funkcji serwerowych**; 41 plików korzysta z klienta z kluczem service role.
- 8 modułów `.server.ts` (admin-auth, consult, instagram, meetings-notify, notifications, notifications-test, orders, youtube).
- 103 pliki importują `@tanstack/react-router`; 11 tras ma loadery.
- Sekrety serwerowe: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, LOVABLE_API_KEY, LOVABLE_CRON_SECRET(+_PREVIOUS), YOUTUBE_API_KEY, INSTAGRAM_APP_ID/SECRET, PUBLIC_SITE_URL, SITE_PRODUCTION_URL, oraz klucze operatorów płatności. Przeglądarka: wyłącznie VITE_SUPABASE_URL / PUBLISHABLE_KEY / PROJECT_ID.

## C. Macierz funkcji (grupy) -> docelowo
| Obszar | Moduły | Uprawnienia/sekrety | Cel | Ryzyko |
|---|---|---|---|---|
| Role, użytkownicy, ostatni superadmin | admin, users, admin-auth | service role, assertAdmin/Superadmin | funkcja `admin-users` (weryfikacja JWT + has_role) | wysokie |
| Ustawienia platformy, marka, moduły | platform, brand | service role (billing_*) | `platform-settings`; publiczny odczyt przez RLS | średnie |
| Centrum kontroli, dziennik, zdarzenia | control-center, admin | service role, logEvent | `control-center` (tylko odczyt) | średnie |
| Zamówienia, płatności, zwroty, is_test | orders(.server), payments | klucze operatorów, podpisy | `orders`, `payments-admin`; webhooki `pay-p24/payu/tpay` | **krytyczne** |
| Biblioteka, PDF, tokeny pobrań, znak wodny | library, library-delivery | service role, prywatny storage | `library-delivery` (podpisane URL-e) | wysokie |
| Obrazy z prywatnych zasobów (7 tras) | api/public/* | service role | `media-public` + zmiana adresów obrazów | wysokie (SEO, OG) |
| CMS, Visual Builder, strony prawne | pages, templates, articles | service role, SHA-256 wersji | `cms` | wysokie |
| Komentarze gości, newsletter, kontakt | guest-comments, newsletter, article-newsletter, contact | service role, tokeny | `public-forms` | średnie |
| Spotkania, konsultacje, przypomnienia | meetings, consult(.server), meetings-notify | service role, cron | `meetings`, `cron-consult` | średnie |
| Powiadomienia e-mail (dispatch) | notifications(.server/-test) | tryb test, idempotencja | `notifications` | średnie |
| AI asystent i materiały | editor-ai, editor-materials | LOVABLE_API_KEY | `ai-editor` | średnie |
| Głos TNB, YouTube, Instagram | voice, podcast, youtube/instagram.server, callback, cron | YOUTUBE_API_KEY, INSTAGRAM_* | `media-sync`, `instagram-callback`, `cron-instagram` | średnie |
| Avatary, multimedia, rekomendacje | avatar, media, recommend | service role | `media-admin`, `avatars` | niskie |

Każda funkcja zachowuje ten sam kontrakt wejścia/wyjścia (walidacja zod), a ekrany wywołują ją przez `supabase.functions.invoke` z sesją użytkownika.

## D. Blokery i decyzje przed BUILD
1. **Podgląd Lovable**: ten projekt jest przypięty do szablonu TanStack Start. Zmiana na SPA może przestać działać w podglądzie i w publikacji Lovable — do potwierdzenia na kopii (remix) projektu, nie na oryginale. Rekomendacja: migracja w kopii.
2. **Adresy webhooków i callbacku Instagram** zmienią się na adres funkcji backendowej — wymaga zmiany w panelach operatorów płatności i Meta.
3. **Adresy obrazów** `/api/public/...` — hosting statyczny ich nie obsłuży; zamiana na adres funkcji lub podpisane URL-e (wpływ na og:image).
4. **SEO**: bez SSR roboty i podglądy linków (Facebook) nie zobaczą tytułów/opisów artykułów — świadoma decyzja.
5. **Crony**: harmonogramy trzeba przepiąć na nowe funkcje.
6. Wybór React Router (data mode z `createBrowserRouter`, zachowanie lazy i error boundaries) — rekomendowany.
7. Koszt: 217 funkcji do przeniesienia, ok. 100+ plików do zmiany importów.

## E. Etapy
1. **Mapa tras** — tabela URL -> komponent -> guard -> parametry/search; brak zmian. Akceptacja: kompletna mapa 72 tras.
2. **Szkielet SPA** — `index.html`, `src/main.tsx`, `vite.config.ts` (react + tailwind + tsconfig-paths), `public/.htaccess`. Akceptacja: `vite build` -> `dist/`.
3. **Routing i layouty** — `src/router.tsx` (React Router), zamiana `Link/useNavigate/useParams/useSearch` w 103 plikach, guard `RequireAuth` zamiast `_authenticated`, `head()` -> komponent ustawiający title/meta, 404 i error boundary. Wygląd bez zmian. Test: każda trasa i deep-link po odświeżeniu.
4. **Backend** — utworzenie funkcji brzegowych wg macierzy C, wspólny moduł autoryzacji (JWT + has_role) i logEvent; webhooki z weryfikacją podpisu; przepięcie cronów. Ekrany wywołują nowe funkcje. Test: istniejące testy Vitest przeniesione na funkcje + E2E zamówienia testowego, ochrona ostatniego superadmina, is_test w statystykach.
5. **Usunięcie TanStack Start/Nitro** — pakiety i pliki serwerowe usunięte dopiero po przejściu etapu 4.
6. **Testy i paczka** — `vite preview`, skan `dist/` na sekrety (brak service role, LOVABLE_API_KEY), test odświeżania tras na Apache.
7. **Akceptacja** — kryteria końcowe z zlecenia.

Nietknięte w każdym etapie: baza, dane, RLS, role, storage, sekrety (tylko dodanie do funkcji), tryb e-mail test, płatności wyłączone.

## F. Szczegóły techniczne
- Dodać: `react-router` (v7), `@vitejs/plugin-react`, `@tailwindcss/vite`.
- Usunąć: `@tanstack/react-start`, `@tanstack/router-plugin`, `@tanstack/react-router`, `@tanstack/zod-adapter`, `nitro`, `@lovable.dev/vite-tanstack-config`; pliki `src/server.ts`, `src/start.ts`, `routeTree.gen.ts`, `src/routes/api/**`, `*.functions.ts`, `*.server.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`.
- Zachować: `@tanstack/react-query` (używane w UI), `zod`, `@lovable.dev/cloud-auth-js` (Google), komponenty UI, `styles.css`, `src/integrations/supabase/client.ts`, `types.ts`, `supabase/` (migracje), `db-proposals/`.
- Instalacja zgodnie z `bun.lock` (`bun install --frozen-lockfile`), build `vite build` -> `dist/`.
- `.htaccess`: `RewriteEngine On`, `RewriteCond %{REQUEST_FILENAME} !-f`, `!-d`, `RewriteRule . /index.html [L]`.
- Przesyłka Total Commander: cała zawartość `dist/` (index.html, assets/, .htaccess, robots.txt, favicon) do `public_html`.
- Ryzyko konfliktu: Vite 8 vs wersje wtyczek — sprawdzić przy etapie 2.

## Szacunek
Duży. Największe ryzyko: zamówienia/webhooki, dostarczanie PDF, obrazy prywatne, utrata SEO, zgodność z podglądem Lovable.
