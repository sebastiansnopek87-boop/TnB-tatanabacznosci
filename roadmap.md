# Roadmap
- [x] Panel administratora: pięć grup menu i czytelne karty; 25 linków klikniętych, 5 grup zwijanych/rozwijanych, 10 statystyk identycznych przed/po, aktywna pozycja i widoki 1280/1207/768/390/320 px PASS; 19 testów Centrum kontroli + 40 stron PASS, build OK i brak błędów JS. Gość przekierowany do logowania; innych ról nie testowano na osobnych sesjach. Bez zmian bazy/uprawnień/CMS/strony publicznej i publikacji.
- [x] Głos TNB: poprzedni/następny i rekomendacje bez duplikatów z istniejącego katalogu/kategorii/kolejności; 8 testów nawigacji + 40 stron + 19 Centrum kontroli PASS, build OK; rzeczywiste kliknięcia trzech opublikowanych odcinków, odtwarzanie/pauza/przewijanie/reset i 1280/390/320 px PASS. Tylko 3 odcinki publiczne — brak możliwości rzeczywistego sprawdzenia 4 rekomendacji i chronionego odcinka, te przypadki sprawdzone w testach danych, nie pełnym E2E. Bez zapisów danych/migracji/publikacji.
- [x] Przycisk społeczności w filmowym HERO: osobne cele gościa/zalogowanego, tryb stały/sesyjny i widoczność w CMS; 40 testów stron + 19 regresji PASS, build OK; trwały zapis obu adresów/etykiety po odświeżeniu i oba podglądy PASS, rzeczywiste kliknięcia gość→rejestracja oraz zalogowany→społeczność PASS, brak błędów JS. Próbne wartości przywrócone, domyślne ustawienia zapisane w szkicu; bez publikacji (home już opublikowane 19:52 przed tym zadaniem).
- [x] Jawne zatwierdzanie dokumentów prawnych: checkbox dla konkretnej treści, SHA-256 + wersja publish + zweryfikowany dziennik, warunkowy zapis updated_at; 28 testów CMS i 19 regresji PASS, build OK; podgląd potwierdza blokadę/reset checkboxa i 5 tras HTTP 200 bez błędów. Zatwierdzenie/publikacja tylko w pamięci testów — żadnych zapisów i publikacji rzeczywistych dokumentów, bez migracji.
- [x] Strony prawne: istniejący CMS i Visual Builder, stałe adresy, ostrzeżenia i serwerowa blokada publikacji bez treści/zatwierdzenia; 15 testów w pamięci PASS, 19 testów regresji PASS, odczytowy podgląd 5 tras i formularza PASS; bez migracji, zapisów dokumentów i publikacji. Zapis/odczyt prawdziwego dokumentu pozostaje nieprzetestowany — treści i zatwierdzenie to osobny etap.
- [x] Centrum kontroli 360°: parametr record (UUID) otwiera istniejące szczegóły zamówienia/konta; tytuły i slugi materiałów; e-mail related_id + trzeci offset historii. 19 testów PASS i zalogowane E2E tylko odczytowe PASS; bez zmian bazy i publikacji.
- [x] Centrum kontroli Etap 3: historia dokładnych obiektów oddzielona od aktora, jawne błędy/limity, powiązania user_id/e-mail, wspólny hasAccess, slugi i pełne nazwisko, istniejące linki; 8 testów PASS, E2E odczytowe PASS, zamówienie 1010 niezmienione, bez zmian bazy; raport Etap-3-Centrum-kontroli-TNB.md.
- [x] Moje TNB: ograniczony audyt 0057 i aktualnych zabezpieczeń; regresja tylko do odczytu 1280/390 px, 9 testów PASS i raport; wykryto nadmiarowe ACL (TRUNCATE), bez zmian bazy i danych
- [ ] Moje TNB: ograniczenie nadmiarowych uprawnień user_avatars — wymaga osobnej zgody właściciela; audyt nie wprowadza napraw
- [ ] Moje TNB: pełny zapis/odczyt profilu oraz avatary wpisu i komentarza — potrzebne uzgodnione konto testowe i izolowane środowisko; brak zgody na zmianę rzeczywistych danych
- [x] Moje TNB: analiza istniejących funkcji, avatarów i uprawnień; minimalny plan oraz SQL przygotowane — wdrożenie czeka na osobną zgodę na bazę
- [x] Moje TNB: powitanie, cztery szybkie akcje, uporządkowana przestrzeń oraz osobne ustawienia konta
- [x] Moje TNB: bezpieczne własne avatary, wspólny widok w nagłówku i społeczności, skróty zgodne z faktycznym dostępem
- [x] Moje TNB: avatar dodanie/podgląd/zapis/odświeżenie/zmiana/usunięcie, SVG i fałszywy WebP, obcy identyfikator, walidacja profilu/hasła, skróty, superadmin i desktop/390 px; 9 testów automatycznych PASS
- [ ] Moje TNB: pełne E2E zwykłego konta, moderatora i administratora — potrzebne wskazanie istniejących kont oraz zgoda na sesje
- [ ] Moje TNB: skuteczna zmiana hasła — wymaga istniejącego konta testowego i uzgodnienia; hasła właściciela nie zmieniano
- [x] Slogan marki: diagnoza, zaakceptowany minimalny plan i finalny SQL aktualizacji walidacji
- [x] Slogan marki: migracja 0055, pola panelu, wspólny odczyt; E2E zapisu/odświeżenia/edycji/ukrycia/pustego tekstu w nagłówku, menu, stopce, logowaniu i rejestracji 1280/390 px; logi potwierdzone, próbny tekst przywrócony
- [x] Logo logowania/rejestracji z useBrand → brand_settings.logo; E2E 1280/390 px: proporcje, niezmienione pola/przyciski/teksty, przełączanie ekranów, brak przepełnienia i błędów; bez zmian bazy
- [x] Menu premium: istniejące linki i logowanie, nieprzezroczysta nakładka, blokada tła, klawiatura i zamykanie
- [x] E2E menu 1280/1206/768/390/320 px: 7 tras, logowanie/rejestracja, zalogowane Moje TNB i wylogowanie, X/Escape, focus i blokada tła; Hero 320 px/tablet bez przepełnienia; 3 testy widoczności PASS, bez migracji
- [x] Nagłówek: nazwa widoczna, menu pod trzema kreskami, przezroczysty stały pasek i lupa; E2E 1440/1920/390 px, wyszukanie i otwarcie artykułu, zalogowane menu, bez przepełnienia i błędów
- [x] Edytor tekstu w istniejącym CMS: formatowanie, czcionki, wyrównanie, położenie, bez migracji
- [x] E2E: czcionka Arial, 24 px, pogrubienie, justowanie, szerokość 80%, położenie centralne; zapis szkicu, odczyt po przeładowaniu, wyczyszczenie próbnego formatowania; mobile 390 px bez przepełnienia

- [x] Finalny SQL jednej migracji brand_settings — zatwierdzony i wykonany (0054)
- [x] Ustawienia marki jak na nagraniu — zakończone, bez dalszej rozbudowy

- [x] Podmiana logo TNB: strona, logowanie, favicon i znak wodny nowych PDF
- [x] Przełączniki widoczności modułów w menu i na stronie — zapis, odczyt po odświeżeniu, ukrycie i przywrócenie Głosu TNB w E2E; mobile bez przepełnienia

- [x] Głos TNB: trwałe ręczne metadane YouTube + raport synchronizacji
- [x] Głos TNB: zunifikowana lista materiałów, najnowszy materiał, filtry tylko dla realnych źródeł
- [x] Głos TNB: migracja external_url + youtube_id opcjonalne (0052, zaakceptowana)
- [x] Głos TNB: panel admina — edycja, archiwizacja, wyróżnienie, kolejność, dodawanie ręczne, raport synchronizacji
- [x] Głos TNB: testy E2E + tabela wyników

## ETAP — Ustawienia marki (brand_settings) — ZAKOŃCZONY 2026-10-14
- [x] Migracja brand_settings (walidacja publicznych danych, CHECK, GRANT SELECT) — wykonana za zgodą
- [x] Panel: logo, favicon, obraz udostępowania, obraz w nagłówku + rozmiar, SEO strony głównej, publiczny adres witryny
- [x] Serwer: createBrandUpload / finalizeBrandUpload / saveBrandSettings (superadmin, logowanie, usuwanie zastąpionych plików)
- [x] Serwowanie prywatnych plików marki przez /api/public/brand/$file po sprawdzeniu referencji
- [x] Nagłówek/stopka używają logo marki; favicon/og:image/SEO strony głównej z ustawień
- [x] E2E: przesyłanie, zapis, serwowanie 200/404, favicon+og+tytuł, sprzątanie, mobile 390px, dziennik zdarzeń

## Centralne ustawienia danych firmy (2026-10-18) — ZROBIONE
- Migracja 0058: platform_settings +18 kolumn (firma, kontakt, faktury, stopka)
- /admin/ustawienia: sekcje firma/faktury/stopka; SiteFooter i /kontakt podpięte pod ustawienia
- Testy: platform.test.ts 5/5 PASS; E2E PASS

- [x] Strona główna w Visual Builderze: wspólny renderer, 7 edytowalnych sekcji, przełącznik Niezalogowany/Zalogowany, szkic bez publikacji.
- [ ] Nagłówek, menu i stopka w edytorze wizualnym (globalne) — osobny etap.
## ETAP 1 — Hardening platform_settings (2026-11-09)
- [x] getPlatformSettings: odczyt danych administracyjnych przez serwerowy klient po assertAdmin
- [x] Przygotować (nie stosować) migrację ograniczającą odczyt anon/authenticated do publicznych kolumn — db-proposals/platform_settings_least_privilege.sql
- [x] Testy: lokalna próba migracji z rolami, panel admina, zapis, strona publiczna
- [ ] Zastosowanie migracji w bazie projektu — czeka na akceptację właściciela

- [x] Filmowa sekcja „pięć etapów życia”: jeden blok na początku istniejącego szkicu home, pięć obrazów i edytowalne pola; 33 testy stron i 19 regresji PASS, build OK, zapis/odczyt i przywrócenie próbnego nagłówka PASS; 7 dotychczasowych sekcji oraz publiczna / niezmienione, bez publikacji. Przesyłanie nowych zdjęć w tym etapie nie było testowane.

## React SPA migration — continuation 2026-11-16
- [x] Synchronize the 10 deployed Supabase Edge Functions missing from the repository into `supabase/functions`, including their deployed source files and Deno import maps.
- [x] Align `supabase/config.toml` JWT settings for those functions with the active Supabase deployment.
- [x] Verify Supabase/GitHub Edge Function parity: 29 active functions, 29 source directories and 29 explicit config sections. Compared every deployed function file (including shared modules and Deno import maps) byte-for-byte with GitHub; all match. Found and deployed the newer GitHub `tnb-contact` source as version 7; `verify_jwt=false` remains as configured.
- [x] Guest article comments now call `tnb-guest-comments` directly from the browser API adapter; form and confirmation route no longer use `useServerFn` for these actions.
- [x] Free library delivery/history now calls `tnb-library-delivery` directly; history UI no longer wraps those actions with `useServerFn`.
- [x] Consultations: `src/lib/api/consult.ts` invokes `tnb-consult` directly; public booking, token lookup, user booking history/cancellation and all admin actions use the Edge Function. No consultation UI call site uses `useServerFn`. Existing server implementation retained as rollback reference; build/E2E still pending.
- [x] Editorial AI assistant: all actions invoke `tnb-editor-ai` through the browser API adapter; no related UI call site uses `useServerFn`.
- [x] Meetings: all 16 actions now invoke `tnb-meetings` through the browser API adapter; public detail/registration, participant history and withdrawal, token confirmation, and admin CRUD/registration/image actions no longer use `useServerFn` in their UI call sites. Server implementation retained as rollback reference; build/E2E still pending.
- [x] Głos TNB / Instagram: story submissions, admin review, public Instagram feed, Instagram settings, OAuth start, sync and disconnect now call `tnb-voice` directly from the browser adapter. YouTube already uses `tnb-youtube`; the Meta GET OAuth callback remains a server route and is tracked with the remaining SSR/API handlers.
- [x] AI materials workflow: all 15 actions invoke `tnb-editor-materials` through the browser API adapter; preview, generation, image handling, editing, version restore and handoff UI no longer uses `useServerFn`. Edge authorization remains superadmin-only, matching the previous server implementation.
- [x] Article newsletter: read, prepare, edit, test-send, explicit superadmin send and unmark actions invoke `tnb-article-newsletter` directly; role checks and explicit send confirmation remain enforced by the Edge Function.
- [x] Library administration: list/edit/status, signed downloads, cover previews, secure file upload and PDF watermark processing use `tnb-library-admin`; uploads use signed Storage upload URLs followed by server-side validation/finalization.
- [x] Library AI recommender invokes the public `tnb-recommend` Edge Function directly.
- [x] Removed remaining `useServerFn` wrappers from the consultation history/cancellation UI and free-library request/redeem UI; route and custom-component inventory now has no remaining `useServerFn` call sites.
- [x] Moved the shared platform settings types out of the legacy TanStack server module; the browser API layer now has no type-only dependency on `platform.functions.ts`.
- [x] Payment callbacks: `tnb-orders` sends new provider notifications directly to `tnb-payments?provider=...`; P24/Tpay/PayU signature checks and provider confirmation remain in the Edge Function. The live database had no orders for these providers, so the three obsolete TanStack webhook routes were removed.
- [x] Public media: article, avatar, brand, page, library, meeting and podcast image URLs now always target their existing Supabase Edge Functions; the seven duplicate TanStack image-serving routes and their local fallbacks were removed. Publication/reference checks and private-avatar visibility checks remain in the Edge Functions.
- [x] Instagram OAuth callback: `tnb-voice` now accepts the Meta GET callback, validates the existing single-use 10-minute state, exchanges the code server-side and redirects to the admin panel. `public/.htaccess` forwards the existing callback path to the Edge Function, so the Meta redirect URI remains unchanged.
- [x] Cron: konsultacje i Instagram przeniesione do aktywnych zadań pg_cron → Supabase Edge Functions; sekret TNB_CRON_SECRET w Vault, walidacja w obu funkcjach; potwierdzono aktywne harmonogramy co 15 i 30 minut. Usunięto zbędne endpointy cron TanStack Start z aplikacji. Test wykonania zadań i dostarczenia wiadomości pozostaje osobnym sprawdzeniem operacyjnym.
- [x] Frontend SPA — statyczny CSR: `index.html` + `src/main.tsx` uruchamiają React przez `createRoot` i TanStack Router; Vite używa bezpośrednio pluginów React/Router/Tailwind/tsconfig-paths. Brak SSR shell i `Scripts`; metadane tras są obsługiwane przez `HeadContent` renderowany do `document.head`.
- [x] Produkcyjny runtime odłączony od TanStack Start: Vite buduje statyczne `dist`; usunięto `src/start.ts` i `src/server.ts`, nazwę pakietu zmieniono na `tnb-react-spa`. Legacy `*.functions.ts` / `*.server.ts` pozostają jeszcze w źródłach dla testów regresyjnych i rollbacku. `@tanstack/react-start` jest wyłącznie w `devDependencies`; `nitro` i `@lovable.dev/vite-tanstack-config` zostały usunięte z manifestu i lockfile.
- [x] CI po przełączeniu: `bun install --frozen-lockfile`, `vite build`, smoke test 14 tras głębokich i `.htaccess`, `tsc --noEmit`, 98 testów jednostkowych, skan `dist` pod kątem kodu/sekretów serwerowych i lint — PASS.
- [ ] Przenieść testy logiki pozostałych modułów `*.functions.ts` do testów Supabase Edge Functions, następnie usunąć nieużywane moduły TanStack Start i samą zależność `@tanstack/react-start` z `devDependencies`. Nie usuwać modułów, dopóki ich przypadki testowe nie mają odpowiedników.
- [ ] Zweryfikować wdrożenie `dist` na CyberFolks: fallback, odświeżanie tras, logowanie, callback Instagrama i przepływy zakupowe. Następnie wykonać autoryzowane E2E gość/użytkownik/admin/superadmin.
- [ ] Reconcile the generated Supabase types and migration inventory with the live project; no database schema or production data changes were made in this continuation.
- [x] Consultation calendar regression tests: Warsaw winter/summer conversion, DST transition, round-trip, date arithmetic and exact 2-hour cancellation boundary; included in Vitest CI (PR #11, all checks PASS).
- [x] Added a CI isolation gate scanning the full `src/` tree: browser/runtime source cannot import legacy `*.functions.ts` / `*.server.ts` modules or the server-only Supabase admin client. The 41 remaining legacy source files are retained as isolated migration/rollback references; they are not yet deleted.
- [ ] Complete the remaining 41-file legacy inventory module by module: verify each operation has a matching Supabase Edge Function/API adapter and regression coverage, then remove the obsolete source and `@tanstack/react-start` dependency. Do not remove rollback references before equivalent tests pass.
- [x] Extracted the platform settings validation schema and public-column allowlist into `src/lib/platform-schema.ts`; its regression tests no longer import the legacy `platform.functions.ts` module. This is the first test module decoupled from TanStack Start.
- [x] CI on commit `9b9c1c0c`: static build, deep-route fallback, TypeScript, SPA boundary, legacy-runtime isolation, 29 Edge Function source/config checks, 104 unit tests, dist secret scan and changed-file lint — PASS.
- [x] Extracted payment signature primitives (P24, Tpay, PayU) into `src/lib/payments/provider-signatures.ts`; payment signature regression tests no longer import `providers.server.ts`. Server adapter continues to use the same verified helpers.
- [x] CI on commit `6dd12da9`: build, route fallback, typecheck, SPA boundary, legacy import isolation, Edge Function coverage, all 104 unit tests, dist secret scan and lint — PASS.
- [x] Payment signature verification tests now import the exact helper module used by deployed `tnb-payments` (P24 registration/notification, Tpay MD5, PayU MD5/SHA-256 and constant-time comparison); the Edge Function provider adapter no longer maintains a separate copy of these algorithms. Legacy server helper remains only as rollback reference until the wider Start cleanup.
- [x] Extracted the paid-order entitlement rule into `src/lib/orders-access.ts`; its regression tests no longer load `orders.server.ts` or any TanStack Start code.
- [x] Removed the last dynamic legacy import from the platform schema tests. Runtime isolation gate now scans production source separately from test-only rollback fixtures; current production UI has no imports of the legacy server modules.
- [x] CI on commit `10079ee9`: build, SPA route smoke test, TypeScript, SPA boundary, legacy isolation, Edge Function coverage, unit tests, static secret scan and lint — PASS.

- [x] Added an explicit legacy-runtime test allowlist: only the two existing mocked integration suites may still load Start handlers; all other test/source files are scanned for static, multiline, dynamic and `require()` imports. Removed the platform test's dynamic import of `platform.functions.ts`.
- [x] Added consultation SPA adapter contract tests for all 11 actions. Tests verify each action is still represented by the legacy contract and `tnb-consult` Edge Function, every SPA operation invokes the intended Edge Function with its action/payload, and invocation errors are propagated. CI on commit `ce322fd8`: build, route fallback, TypeScript, SPA boundary, legacy isolation, Edge Function coverage, unit tests, static secret scan and lint — PASS.

- [x] Biblioteka: dodano test kontraktu React SPA ↔ Supabase dla 11 akcji administracyjnych i 4 akcji dostarczania materiałów; testy obejmują wywołania adapterów, obecność akcji w legacy i Edge, granice admin auth, kontrolę `library_can_read` przed signed URL, hashowanie tokenu i powiązanie z materiałem oraz zgodność parametrów watermark. Wynik CI dla aktualnego commitu jest jeszcze oczekiwany; pełne E2E i wizualna inspekcja PDF pozostają osobne.

- [x] Przygotowano wspólny transport SMTP dla powiadomień, newslettera, zamówień, konsultacji, kontaktu i bezpłatnych materiałów. Dodano double opt-in z wysyłką i stroną potwierdzenia. Tryb produkcyjny wymaga kompletnych sekretów oraz udanego testu połączenia. Instrukcja obejmuje Cyber_Folks i osobną konfigurację Supabase Auth. CI PASS: run `43918013467` dla `09877e4a3347ed9c75b08dc2fd6fd24573309021`. Sekrety nie są jeszcze ustawione, więc produkcyjna wysyłka pozostaje wyłączona.

- [ ] Zamówienia/płatności — audyt pierwszej inspekcji zapisany w `docs/migration/legacy-runtime-inventory.md` (2026-11-16). Przed usunięciem legacy: potwierdzić powiązanie `providerRef` z rekordem zamówienia dla P24/Tpay/PayU; zaprojektować retry/outbox dla skutków ubocznych webhooka; dodać idempotencję tworzenia zamówień; pokryć kontrakt SPA ↔ Edge ↔ legacy i przejścia statusów testami. Nie zmieniać live operatorów ani DB bez testów.

- [x] Płatności — potwierdzono kontrakty referencji P24 (`sessionId`), Tpay (`title` ↔ `tr_id`, `hiddenDescription` ↔ `tr_crc`) i PayU (`orderId` ↔ zapisany identyfikator PayU); Edge Function porównuje niezależnie zapisaną referencję operatora. Naprawiono P24: brak udanej weryfikacji `transaction/verify` nie otrzymuje ACK i może być ponowiony. Dodano testy referencji, bramki P24 i adapterów SPA. Testy CI dla najnowszego commitu są w toku.
- [ ] Płatności — dodać idempotency key przy tworzeniu zamówienia oraz trwały outbox/retry dla skutków ubocznych po zmianie statusu na `paid`; wymaga migracji schematu i planu bezpiecznej obsługi istniejących zamówień.


- [x] Zamówienia/płatności — audyt idempotencji i dostaw wykonany read-only 2026-11-16; potwierdzono brak idempotency key zamówienia, brak outbox/worker, nieatomowe `afterPaid` i blokadę automatycznego retry przez stały unikalny klucz wiadomości. Schemat live ma 40+ migracji w historii, repo zawiera obecnie tylko jeden plik migracji — przed nową migracją wymagane uzgodnienie pełnej historii. Raport: `docs/migration/orders-idempotency-outbox-audit.md`. Brak zmian w DB i danych.
- [ ] Zamówienia/płatności — uzgodnić kompletny łańcuch migracji repo ↔ Supabase, następnie wdrożyć idempotency key i atomowy outbox z workerem retry. Nie stosować zmian live przed uzgodnieniem schematu i testami współbieżności.
