# Inwentaryzacja pozostałości TanStack Start

Stan na 2026-11-27, branch `main`.

## Zasady oceny

Ta lista jest mapą migracyjną, a nie potwierdzeniem równoważności funkcjonalnej. Obecność adaptera SPA i Edge Function o pasującej nazwie nie dowodzi zgodności payloadów, uprawnień, RLS, walidacji, obsługi błędów ani skutków ubocznych. Żaden plik legacy nie może zostać usunięty przed porównaniem tych elementów i testem regresji.

Po scaleniu PR #39–44 i #47 usunięto 8 plików legacy: `guest-comments.functions.ts`, `newsletter.functions.ts`, `article-newsletter.functions.ts`, `recommend.functions.ts`, `ai/recommend.server.ts`, `contact.functions.ts`, `podcast.functions.ts` i `templates.functions.ts`. Po migracji Głosu TNB i YouTube usunięto `voice.functions.ts` oraz `youtube.server.ts` (PR w przygotowaniu). Po migracji ustawień platformy usunięto również `platform.functions.ts`. Po migracji modułu marki usunięto również `brand.functions.ts`. Pozostaje 29 plików `*.functions.ts` / `*.server.ts` oraz 2 pliki middleware (`auth-middleware.ts`, `auth-attacher.ts`) — łącznie 31 plików legacy. Repo zawiera 32 adaptery w `src/lib/api/` oraz 29 katalogów Supabase Edge Functions. Szczegółowy stan entrypointu i zależności opisano również w `docs/migration/supabase-migration-reconciliation.md`.

## Mapa plików

| Usunięty plik | Docelowy transport | Weryfikacja |
|---|---|---|
| `src/lib/brand.functions.ts` | `src/lib/api/brand.ts` → `tnb-brand` | 4 akcje, dokładne płaskie payloady, Bearer, admin/superadmin, walidacja MIME/limitu 2 MB i finalna weryfikacja metadanych; produkcyjna Edge Function v4 ACTIVE, `index.ts` identyczny z `main`; test kontraktu potwierdza brak Start handlera |


| Usunięty plik | Docelowy transport | Weryfikacja |
|---|---|---|
| `src/lib/platform.functions.ts` | `src/lib/api/platform.ts` → `tnb-platform`; publiczne ustawienia i układ podcastu przez anon SELECT | 7 akcji chronionych, publiczny allowlist kolumn bez pól billingowych, admin/superadmin checks; produkcyjna Edge Function `tnb-platform` v5 identyczna z `main`; test kontraktu rozszerzony o prelaunch |


| Usunięty plik | Docelowy transport | Weryfikacja |
|---|---|---|
| `src/lib/voice.functions.ts` | `src/lib/api/voice.ts` → `tnb-voice` oraz `src/lib/api/youtube.ts` → `tnb-youtube` | 11 akcji Voice + cron i 12 akcji YouTube; produkcyjne Edge Function `tnb-voice` v4 i `tnb-youtube` v2 są aktywne i identyczne z `main`; testy kontraktowe SPA/Edge dodane do CI |
| `src/lib/youtube.server.ts` | `src/lib/api/youtube.ts` → `tnb-youtube` | YouTube API key, synchronizacja kanału i materiałów pozostają po stronie Edge; klucz nie trafia do przeglądarki |


Usunięte moduły opisane powyżej nie są już częścią bieżącego inwentarza. Ich odpowiedniki działają przez adaptery SPA i Edge Functions; usunięcie zatwierdzono po testach kontraktowych oraz zielonym CI.

| Pozostały plik | Docelowy adapter SPA | Kandydat Edge Function | Status |
|---|---|---|---|
| `src/integrations/supabase/client.server.ts` | `src/integrations/supabase/client.ts` | wszystkie funkcje wymagające klienta uprzywilejowanego | infrastruktura; sprawdzić każdy import i sekrety |
| `src/lib/admin-auth.server.ts` | brak bezpośredniego adaptera | `tnb-admin` oraz autoryzacja w poszczególnych funkcjach | wspólna warstwa auth; wymaga audytu roli i RLS |
| `src/lib/admin.functions.ts` | `src/lib/api/admin.ts` | `tnb-admin` | test kontraktu SPA ↔ Edge dodany: 14 akcji, bearer token, odmowa bez sesji, obsługa 403/pustej odpowiedzi, nawigacyjna kontrola roli, walidacja i rozdział admin/superadmin; moduł legacy zachowany do pełnej weryfikacji semantyki |
| `src/lib/ai/editor.server.ts` | `src/lib/api/editor-ai.ts` | `tnb-editor-ai` | porównać limity, model i zapis |
| `src/lib/ai/run-id.server.ts` | do ustalenia | do ustalenia | pomocniczy moduł; ustalić wszystkich konsumentów |
| `src/lib/articles.functions.ts` | `src/lib/api/articles.ts` | `tnb-articles` | dodano test kontraktu 15 akcji Edge z bearer tokenem, direct reads przez RLS po kontroli admina, walidacji, purge/trash, uploadu, ankiet i moderacji komentarzy |
| `src/lib/brand.functions.ts` | `src/lib/api/brand.ts` | `tnb-brand` | dodano test kontraktu 4 akcji, flat payload parity, Bearer, odmowę bez sesji, admin read/superadmin writes, MIME/rozmiar uploadu i weryfikację metadanych po przesłaniu |
| `src/lib/consult.functions.ts` | `src/lib/api/consult.ts` | `tnb-consult` | częściowe testy kalendarza; pełna zgodność nadal do sprawdzenia |
| `src/lib/consult.server.ts` | `src/lib/api/consult.ts` | `tnb-consult` | sprawdzić wspólne reguły terminów i powiadomień |
| `src/lib/control-center.functions.ts` | `src/lib/api/control-center.ts` | `tnb-admin` | test kontraktu SPA ↔ Edge obejmuje wyszukiwanie i historię, walidację zapytań/UUID/paginacji oraz bramkę admin; nadal wymagany audyt kompletności wyników i zgodności semantyki |
| `src/lib/editor-ai.functions.ts` | `src/lib/api/editor-ai.ts` | `tnb-editor-ai` | dodano test kontraktu 15 akcji, parity SPA/legacy/Edge, wymogu superadmin, walidacji i PII scrubbing; zewnętrzny provider AI wymaga osobnego testu integracyjnego |
| `src/lib/editor-materials.functions.ts` | `src/lib/api/editor-materials.ts` | `tnb-editor-materials` | dodano test kontraktu 15 akcji, dynamicznej allowlisty Edge, walidacji w warstwie logic i wymogu superadmin w Edge oraz legacy; sprawdzić provider AI i handoff E2E |
| `src/lib/instagram.server.ts` | brak potwierdzonego adaptera | do ustalenia (możliwy `tnb-media`) | OAuth/sekrety; blokada do audytu przepływu |
| `src/lib/library-delivery.functions.ts` | `src/lib/api/library-delivery.ts` | `tnb-library-delivery` | test kontraktu SPA ↔ Edge dla 4 akcji; auth admin, token hash i związanie tokenu z materiałem objęte kontrolą statyczną; testy CI/E2E oczekują na wynik |
| `src/lib/library.functions.ts` | `src/lib/api/library.ts` | `tnb-library-admin` | istniejący test kontraktu obejmuje 11 akcji, upload/finalize, bramkę admin, direct-download entitlement i zgodność watermark; dodano odrzucanie pustej odpowiedzi w adapterze SPA; CI PASS (pełny pipeline) |
| `src/lib/library/pdf.server.ts` | `src/lib/api/library.ts` (pośrednio) | `tnb-library-admin` / `tnb-library-delivery` | PDF; porównać watermark i przechowywanie |
| `src/lib/library/watermark-logo.server.ts` | brak w przeglądarce | `tnb-library-admin` | zasób serwerowy; usunąć po potwierdzeniu użycia w Edge |
| `src/lib/library/watermark.server.ts` | brak w przeglądarce | `tnb-library-admin` | logika PDF pozostaje wyłącznie po stronie Edge; testy porównują wymiary/pozycję znaku, minimalną szerokość strony i producer marker; pełny test wizualny PDF nadal wymagany |
| `src/lib/media.functions.ts` | `src/lib/api/media.ts` | `tnb-media-admin` + publiczne `tnb-media` | dodano test kontraktu 5 akcji admin, token Bearer, brak sesji, 403, walidację uploadu i fail-closed usuwanie plików w użyciu; publiczne serwowanie obrazów pozostaje osobnym przepływem |
| `src/lib/meetings-notify.server.ts` | `src/lib/api/meetings.ts` | `tnb-meetings` / `tnb-notifications` | sprawdzić harmonogram i status wysyłki |
| `src/lib/meetings.functions.ts` | `src/lib/api/meetings.ts` | `tnb-meetings` | dodano test kontraktu 16 akcji public/user/admin, parity legacy/Edge, rozdział requireUser/requireAdmin, zgody, antyspam i limity uploadu; powiadomienia wymagają odrębnego testu skutków ubocznych |
| `src/lib/notifications-test.server.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | testowe wysyłki; sprawdzić dostęp wyłącznie admin |
| `src/lib/notifications.functions.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | dodano test kontraktu dla 11 akcji, tokenu Bearer, braku sesji, 403, pustej odpowiedzi oraz granic admin/superadmin; legacy zachowany do porównania semantyki odbiorców i providerów |
| `src/lib/notifications.server.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | provider/sekrety; obecnie tryb testowy |
| `src/lib/orders.functions.ts` | `src/lib/api/orders.ts` | `tnb-orders` | porównać statusy i idempotencję |
| `src/lib/orders.server.ts` | `src/lib/api/orders.ts` | `tnb-orders` | porównać operacje uprzywilejowane |
| `src/lib/pages.functions.ts` | `src/lib/api/pages.ts` | `tnb-pages` | dodano test kontraktu 13 akcji public/admin, bearer, public anonymous read, brak sesji, 403, draft/version, legalConfirmed i expectedDigest przed publikacją |
| `src/lib/payments.functions.ts` | `src/lib/api/payments.ts` | `tnb-payments` | testy podpisów Edge; pełne testy webhooków i refundów wymagane |
| `src/lib/payments/providers.server.ts` | `src/lib/api/payments.ts` | `tnb-payments` | przeniesiono współdzielone podpisy do Edge; porównać pełną konfigurację |
| `src/lib/platform.functions.ts` | `src/lib/api/platform.ts` | `tnb-platform` | test kontraktu SPA ↔ Edge dodany: wszystkie 6 akcji, bearer token, odmowa bez sesji, obsługa błędów, oddzielenie publicznych od chronionych odczytów i kontrola allowlisty kolumn/role gates; test dołączony do CI; moduł legacy zachowany do czasu pełnego porównania semantyki |
| `src/lib/users.functions.ts` | `src/lib/api/users.ts` | `tnb-users` | test kontraktu SPA ↔ Edge obejmuje 3 akcje, bearer token, brak sesji, 403 i bramki admin/superadmin; Edge zmienia role przez atomową procedurę DB `admin_set_user_role`; legacy zachowany do pełnej weryfikacji semantyki |
| `src/lib/voice.functions.ts` | `src/lib/api/voice.ts` | `tnb-voice` | porównać upload, limity i prywatność |
| `src/lib/youtube.server.ts` | `src/lib/api/youtube.ts` | `tnb-youtube` | OAuth/sekrety; sprawdzić callback i odświeżanie tokenów |

## Kolejność migracji

1. Najpierw testy kontraktowe adapter SPA ↔ Edge Function dla każdej akcji, z testami uprawnień anon/user/admin i przypadków błędów.
2. Następnie migracja modułów pomocniczych, których odpowiedniki są już używane przez Edge Functions (`watermark`, `pdf`, podpisy płatności) po porównaniu zachowania.
3. Potem usuwanie plików `.functions.ts` / `.server.ts` partiami. Po każdej partii: pełne testy, typecheck, build, kontrola importów i aktualizacja inwentarza.
4. Pliki auth middleware i `client.server.ts` usunąć dopiero po wykazaniu, że nie są osiągalne z kodu aplikacji ani konfiguracji.
5. `@tanstack/react-start` usunąć z manifestu i lockfile dopiero po wyzerowaniu zależności od tych modułów i przejściu czystej instalacji oraz CI.

## Znane blokady funkcjonalne poza samą migracją

- Edge Function `tnb-notifications` ma `delivery_mode: test` i niepodłączonego dostawcę poczty. Wiadomości nie są faktycznie dostarczane.
- `tnb-consult` również zapisuje wysyłki jako symulowane; status `simulated` nie jest równoznaczny z wysłaniem.
- Nie zmieniać sekretów ani dostawcy bez danych konfiguracyjnych i testu dostarczenia.
- Nie ma potwierdzonego wdrożenia i testu produkcyjnego na CyberFolks.

## Warunek zamknięcia migracji

Liczba pozostałych modułów legacy w `src/` = 0; brak `@tanstack/react-start` w kodzie, konfiguracji, zależnościach i lockfile; komplet testów regresji kontraktów, ról, webhooków i głównych przepływów; CI PASS na PR; osobny test produkcyjny hostingu i Supabase.

## SMTP i system powiadomień (2026-11-16)

- Wspólny transport `supabase/functions/_shared/smtp.ts` używa Nodemailer i sekretów Edge Functions; nie udostępnia danych SMTP w kliencie.
- Podłączono transport do `tnb-notifications`, `tnb-newsletter`, `tnb-article-newsletter`, `tnb-orders`, `tnb-consult`, `tnb-library-delivery` i `tnb-contact`; `tnb-admin` weryfikuje połączenie przed włączeniem trybu live i double opt-in.
- Tryb `live` wymaga `email_settings.delivery_mode = live` oraz kompletnej konfiguracji SMTP. Panel nie pozwala włączyć trybu live bez weryfikacji połączenia i uwierzytelnienia SMTP.
- Dla Cyber_Folks przewidziano port 465 SSL/TLS. Porty 25 i 587 są odrzucane w helperze z uwagi na ograniczenia Supabase Edge.
- Dodano instrukcję `docs/operations/smtp-cyberfolks.md` oraz test kontraktowy. Double opt-in ma teraz kompletny przepływ wysyłki tokenu i aktywacji adresu (`/newsletter/potwierdz`); nie da się go włączyć bez aktywnego, zweryfikowanego SMTP.
- CI PASS dla commitu `09877e4a3347ed9c75b08dc2fd6fd24573309021`, run `43918013467`: build, route smoke, TypeScript, SPA boundary, legacy isolation, Edge source/config, 59 unit tests, scan sekretów i lint.
- Sekrety i dane skrzynki nie zostały skonfigurowane ani wdrożone, bo nie są dostępne w narzędziach i nie zostały przekazane; produkcyjna wysyłka pozostaje w trybie testowym.
- Supabase Auth ma osobne ustawienia SMTP w Dashboard → Authentication → SMTP Settings; instrukcja obejmuje tę konfigurację. Nie jest ona automatycznie zmieniana przez Edge Function.


## Audyt zamówień i płatności — pierwsza inspekcja (2026-11-16)

Zakres odczytany z aktualnego brancha: `src/lib/api/orders.ts`, `src/lib/api/payments.ts`, legacy `orders.functions.ts` / `payments.functions.ts`, `supabase/functions/tnb-orders`, `supabase/functions/tnb-payments`, adaptery P24/Tpay/PayU i migracje tabel zamówień/webhooków. Na tym etapie nie zmieniano logiki płatności, danych produkcyjnych, operatorów ani sekretów.

### Potwierdzone mechanizmy

- Cena i waluta zamówienia są pobierane po stronie serwera z rekordu opublikowanego materiału; klient przesyła slug, dane nabywcy, metodę i zgodę.
- Dostęp do materiału wynika z `paid_at`, statusu uprawniającego i braku `access_revoked_at`; samo przekierowanie powrotne z operatora nie nadaje dostępu.
- Zmiany statusów w ścieżce webhooka są warunkowymi UPDATE po bieżącym statusie; potwierdzenie przelewu ręcznego jest ograniczone do `bank_transfer`.
- P24 wykonuje dodatkowe `/transaction/verify` po sprawdzeniu podpisu powiadomienia. Tpay i PayU sprawdzają podpis webhooka; PayU weryfikuje surowe body.
- Zdarzenia webhooków mają klucz główny `event_id`; duplikaty dostają odpowiedź ACK operatora. Przy wyjątku w obsłudze wpis idempotencyjny jest usuwany, aby umożliwić retry.
- Zmiany konfiguracji operatora są ograniczone do superadmina; włączenie operatora live wymaga testu połączenia, a przełączenie środowiska live wymaga jawnego potwierdzenia.

### Otwarte punkty bezpieczeństwa i zgodności — blokują usunięcie legacy

1. **P1 — powiązanie webhooka z referencją transakcji.** Gdy podpisany adapter dostarcza UUID zamówienia w `notice.orderId`, `confirmOperatorPayment` wyszukuje rekord wyłącznie po UUID. Nie porównuje wprost `notice.providerRef` z zapisanym `library_orders.provider_ref`. Należy potwierdzić semantykę referencji każdego operatora (szczególnie Tpay: wartość zwracana przy rejestracji vs `tr_id` w webhooku), a następnie dodać walidację i testy negatywne bez psucia poprawnych callbacków.
2. **P1 — brak atomowości całego procesu webhooka.** Wpis `payment_webhook_events`, zmiana statusu zamówienia, log zdarzenia i przyznanie dostępu są osobnymi operacjami. Warunkowy UPDATE ogranicza podwójne nadanie statusu, ale awaria po zmianie statusu na `paid` i przed `afterPaid` może pozostawić zamówienie opłacone bez zakończonej obsługi dostawy. Potrzebny jest trwały mechanizm retry/outbox dla skutków ubocznych i test awarii między krokami.
3. **P1 — brak idempotency key dla tworzenia zamówienia.** `createLibraryOrder` tworzy nowy rekord przy każdym poprawnym żądaniu; nie wykazano ochrony przed ponowieniem żądania przez klienta/proxy i utworzeniem kilku transakcji dla jednego kliknięcia. Potrzebny jest projekt klucza idempotencji po stronie klienta i unikalnego zapisu po stronie DB, bez deduplikacji dwóch legalnych zakupów.
4. **P2 — brak pełnych testów kontraktu SPA ↔ Edge ↔ legacy dla zamówień i płatności.** Istnieją testy prymitywów podpisu, ale nie ma jeszcze kompletnego zestawu dla akcji, payloadów, uprawnień, błędów, przejść statusów, ACK, duplikatów, kwot/walut i retry.
5. **P2 — rozjazd operacyjny po zmianie środowiska operatora.** Zamówienie zapisuje własne `environment`, a webhook porównuje je z aktualnym środowiskiem konfiguracji operatora. Trzeba określić i przetestować procedurę zmiany sandbox/live przy istniejących oczekujących zamówieniach.

Nie wdrażać poprawek w produkcyjnych webhookach przed testami adapterów i potwierdzeniem kontraktów operatorów. Następny krok: wyodrębnić czyste funkcje normalizacji/walidacji referencji, dodać testy P24/Tpay/PayU i kontrakt SPA/Edge; potem zaprojektować outbox i idempotencję zamówień.


### Doprecyzowanie kontraktów operatorów i poprawka webhooka (2026-11-16)

Dokumentacja operatorów potwierdza mapowanie referencji używane przez adaptery:
- P24: `sessionId` jest identyfikatorem sesji z systemu sprzedawcy; zapisujemy go jako `provider_ref` i odbieramy ponownie w notyfikacji. Weryfikacja `transaction/verify` jest obowiązkowa, a P24 ponawia notyfikacje, jeśli nie otrzyma poprawnego potwierdzenia. Źródło: [P24 — Transaction service API](https://developers.przelewy24.pl/).
- Tpay Open API: `hiddenDescription` wraca jako `tr_crc`; `tr_id` jest tytułem transakcji Tpay. Odpowiedź utworzenia transakcji zawiera `title`, więc obecny wybór `title ?? transactionId` jest zgodny z polem `tr_id`. Źródło: [Tpay — pierwsza transakcja](https://docs-api.tpay.com/pl/first-steps/first-transaction/) i [Tpay — webhooks](https://docs-api.tpay.com/pl/webhooks/).
- PayU: `extOrderId` jest identyfikatorem nadanym przez sprzedawcę, a `orderId` identyfikatorem nadanym przez PayU. Adapter zapisuje PayU `orderId` i odbiera to samo pole w notyfikacji. Źródło: [PayU Europe — API](https://developers.payu.com/europe/pl/api/).

Wdrożone na branchu:
- Dodano wspólną funkcję `providerReferenceMatches` i użyto jej w `tnb-payments`: UUID zamówienia służy do znalezienia rekordu, ale nie zastępuje niezależnego porównania referencji operatora z zapisaną referencją.
- Jeśli referencja nie została jeszcze zapisana (możliwy wyścig pomiędzy utworzeniem transakcji i zapisem `provider_ref`), webhook zwraca HTTP 500 i usuwa tymczasowy wpis idempotencyjny, aby operator mógł ponowić dostarczenie.
- Jeśli istniejąca referencja jest inna, zamówienie oczekujące/nieudane trafia do `needs_review`; nie przyznaje to dostępu.
- Naprawiono P24: nieudane lub niejednoznaczne `transaction/verify` nie jest już zamieniane na stan `pending` z ACK. Adapter zwraca brak poprawnej notyfikacji, dzięki czemu P24 nie dostaje potwierdzenia przed udaną weryfikacją i może ponowić webhook.
- Dodano testy jednostkowe dla porównania referencji i bramki odpowiedzi P24 oraz testy kontraktu adapterów SPA zamówień/płatności.

Pozostałe bramki: idempotencja tworzenia zamówienia, trwały outbox/retry dla `afterPaid`, pełne testy webhooków z symulacją awarii i testy sandbox operatorów. Nie zmieniano danych ani konfiguracji operatorów w Supabase.


## Audyt modułu użytkowników — 2026-11-16

- Dodano test kontraktu SPA ↔ Edge dla `listUsers`, `getUserDetail` i `setUserRole`; test sprawdza payloady, token Bearer, odmowę bez sesji, propagację 403, allowlistę akcji i bramki admin/superadmin.
- Edge Function nie wykonuje ręcznych INSERT/DELETE dla `user_roles`. Zmiana roli wywołuje `public.admin_set_user_role(uuid,uuid,app_role,boolean)`, która blokuje tabelę `user_roles`, sprawdza role aktora, istnienie użytkownika docelowego, zależność superadmin → admin i ochronę ostatniego superadministratora. Zapis zmiany roli i wpisu `admin_events` jest wykonywany wewnątrz procedury.
- Odczyt ACL w aktywnej bazie: funkcja ma `SECURITY DEFINER`, `search_path=public, pg_temp`, właściciela `postgres`; EXECUTE ma wyłącznie `service_role`. Role `authenticated`, `anon` i `public` nie mają EXECUTE. To ogranicza bezpośrednie wywołanie RPC z klienta.
- Historia Supabase zawiera migrację `20261115150058 / 0061_admin_set_user_role_atomic`, ale plik źródłowy tej migracji nie jest obecny w repo. Nie odtwarzano go z samej nazwy ani nie zmieniano bazy. Wymagane odzyskanie oryginalnej treści migracji w ramach uzgadniania brakujących plików.
- Nie usuwano `src/lib/users.functions.ts`; pozostaje potrzebny do porównania zachowania i nie został wykazany jako zbędny.


## Audyt biblioteki i powiadomień — 2026-11-16

- Biblioteka: ponownie wykorzystano istniejący `src/lib/library-api.test.ts` (11 akcji administracyjnych i 4 akcje dostarczania materiałów), bez utrzymywania duplikatu testu. Adapter `src/lib/api/library.ts` odrzuca teraz również pustą odpowiedź Edge Function zamiast zwracać `null` jako pozornie poprawny wynik.
- Kontrola statyczna istniejącego testu biblioteki obejmuje autoryzację admina, bezpośrednie pobieranie pliku dopiero po `library_can_read`, token redemption związany z hashem i konkretnym materiałem oraz geometrię i zasób znaku wodnego. Upload jest dwufazowy: podpisany upload URL, a następnie walidacja ścieżki, typu i rozmiaru podczas finalizacji.
- Powiadomienia: dodano `src/lib/notifications-api-contract.test.ts` dla 11 akcji adaptera `tnb-notifications`. Test obejmuje token Bearer, blokadę bez sesji, propagację 403 i pustej odpowiedzi, allowlistę Edge oraz granice ról. Edycja szablonów, reguł, konfiguracji dostarczania, test SMTP, kontrola duplikatów i retry wymagają superadministratora; odczyt i podgląd logów pozostają dostępne dla administratora.
- Edge nie przełącza wysyłki na `live`, jeśli nie ma kompletnych sekretów SMTP i udanego `verifySmtp()`. W bazie ustawienie `delivery_mode` nadal pozostaje `test`; nie wysyłano wiadomości i nie zmieniano sekretów.
- Nie usuwano żadnych modułów legacy. Różnice między dawnym providerem poczty a obecnym transportem SMTP wymagają osobnej walidacji zachowania i konfiguracji produkcyjnej.


## Audyt kontaktu i newslettera — 2026-11-16

- Kontakt: test adaptera `tnb-contact` obejmuje walidację pól, wysłanie payloadu, propagację błędów i odrzucanie niepoprawnej odpowiedzi. Test statyczny potwierdza ścisły schemat Edge, allowlistę originów, filtr honeypot/czasu wypełnienia i escapowanie treści przed renderowaniem wiadomości.
- Newsletter: test adaptera obejmuje `subscribe`, `unsubscribe` i `confirm`, normalizację adresu, wymóg zgody, błędy Edge i pustą odpowiedź. Test statyczny potwierdza filtr antyspamowy, limit prób IP, double opt-in, potwierdzenie tokenem i wypis.
- Newsletter double opt-in wymaga aktywnego trybu live i poprawnie skonfigurowanego SMTP; produkcyjny SMTP nadal nie jest skonfigurowany, więc testy nie wysyłają prawdziwych wiadomości.
- Testy są włączone do `vitest.unit.config.ts`. Nie usuwano modułów legacy ani nie zmieniano produkcyjnych rekordów kontaktowych/subskrybentów.


## Audyt komentarzy gościnnych — 2026-11-16

- Dodano test adaptera `tnb-guest-comments` dla wysłania, potwierdzenia i ponownej wysyłki linku. Test statyczny obejmuje zgodę na zasady, minimalny czas wypełnienia, limity IP (1/min i 5/h) oraz e-mail (5/h), token przechowywany jako SHA-256, 48-godzinny TTL, maksymalnie 3 wysyłki i limit ponowienia co 10 minut.
- W porównaniu z legacy zachowano te same kluczowe granice bezpieczeństwa i ochronę tokenu. Edge wykonuje cleanup rekordu komentarza, jeśli zapis powiązanych danych gościa się nie powiedzie.
- Test nie tworzy rzeczywistych komentarzy ani nie wysyła e-maili; nie zmieniano danych produkcyjnych.


## Audyt stron CMS — 2026-11-16

- Dodano test kontraktu `tnb-pages` dla publicznego odczytu oraz 12 operacji administracyjnych: list/get, kontrola slug, zapis, status, upload, signed image URLs, draft, publikacja, wersje, przywracanie i draft strony głównej.
- Test potwierdza anonimowy odczyt publicznej strony, token Bearer dla operacji admina, odmowę bez sesji i propagację 403. Kontrola publikacji obejmuje `legalConfirmed` i opcjonalny digest oczekiwanej wersji; operacje pozostają za bramką administratora.
- Nie publikowano stron i nie modyfikowano rekordów CMS.
