# Inwentaryzacja pozostałości TanStack Start

Stan na 2026-11-16, branch `chore/legacy-runtime-audit`.

## Zasady oceny

Ta lista jest mapą migracyjną, a nie potwierdzeniem równoważności funkcjonalnej. Obecność adaptera SPA i Edge Function o pasującej nazwie nie dowodzi zgodności payloadów, uprawnień, RLS, walidacji, obsługi błędów ani skutków ubocznych. Żaden plik legacy nie może zostać usunięty przed porównaniem tych elementów i testem regresji.

W repozytorium znajduje się 41 plików `*.functions.ts` / `*.server.ts` w `src/`, 32 adaptery w `src/lib/api/` oraz 29 katalogów Supabase Edge Functions.

## Mapa plików

| Pozostały plik | Docelowy adapter SPA | Kandydat Edge Function | Status |
|---|---|---|---|
| `src/integrations/supabase/client.server.ts` | `src/integrations/supabase/client.ts` | wszystkie funkcje wymagające klienta uprzywilejowanego | infrastruktura; sprawdzić każdy import i sekrety |
| `src/lib/admin-auth.server.ts` | brak bezpośredniego adaptera | `tnb-admin` oraz autoryzacja w poszczególnych funkcjach | wspólna warstwa auth; wymaga audytu roli i RLS |
| `src/lib/admin.functions.ts` | `src/lib/api/admin.ts` | `tnb-admin` | porównać wszystkie akcje |
| `src/lib/ai/editor.server.ts` | `src/lib/api/editor-ai.ts` | `tnb-editor-ai` | porównać limity, model i zapis |
| `src/lib/ai/recommend.server.ts` | `src/lib/api/recommend.ts` | `tnb-recommend` | porównać wejście/wyjście i uprawnienia |
| `src/lib/ai/run-id.server.ts` | do ustalenia | do ustalenia | pomocniczy moduł; ustalić wszystkich konsumentów |
| `src/lib/article-newsletter.functions.ts` | `src/lib/api/article-newsletter.ts` | `tnb-article-newsletter` | porównać zgodę i skutki newslettera |
| `src/lib/articles.functions.ts` | `src/lib/api/articles.ts` | `tnb-articles` | porównać publiczne/admin operacje |
| `src/lib/brand.functions.ts` | `src/lib/api/brand.ts` | `tnb-brand` | porównać walidację i zapis |
| `src/lib/consult.functions.ts` | `src/lib/api/consult.ts` | `tnb-consult` | częściowe testy kalendarza; pełna zgodność nadal do sprawdzenia |
| `src/lib/consult.server.ts` | `src/lib/api/consult.ts` | `tnb-consult` | sprawdzić wspólne reguły terminów i powiadomień |
| `src/lib/contact.functions.ts` | `src/lib/api/contact.ts` | `tnb-contact` | porównać antyspam i dostarczanie |
| `src/lib/control-center.functions.ts` | `src/lib/api/control-center.ts` | `tnb-admin` | testy zakresu danych i paginacji; sprawdzić role |
| `src/lib/editor-ai.functions.ts` | `src/lib/api/editor-ai.ts` | `tnb-editor-ai` | porównać kontrakty i uprawnienia |
| `src/lib/editor-materials.functions.ts` | `src/lib/api/editor-materials.ts` | `tnb-editor-materials` | porównać upload i dostęp |
| `src/lib/guest-comments.functions.ts` | `src/lib/api/guest-comments.ts` | `tnb-guest-comments` | porównać moderację i limity |
| `src/lib/instagram.server.ts` | brak potwierdzonego adaptera | do ustalenia (możliwy `tnb-media`) | OAuth/sekrety; blokada do audytu przepływu |
| `src/lib/library-delivery.functions.ts` | `src/lib/api/library-delivery.ts` | `tnb-library-delivery` | test kontraktu SPA ↔ Edge dla 4 akcji; auth admin, token hash i związanie tokenu z materiałem objęte kontrolą statyczną; testy CI/E2E oczekują na wynik |
| `src/lib/library.functions.ts` | `src/lib/api/library.ts` | `tnb-library-admin` | test kontraktu SPA ↔ Edge dla 11 akcji; testy statyczne kontroli admina, uprawnienia direct download i zgodności geometrii watermark; CI/E2E oczekują na wynik |
| `src/lib/library/pdf.server.ts` | `src/lib/api/library.ts` (pośrednio) | `tnb-library-admin` / `tnb-library-delivery` | PDF; porównać watermark i przechowywanie |
| `src/lib/library/watermark-logo.server.ts` | brak w przeglądarce | `tnb-library-admin` | zasób serwerowy; usunąć po potwierdzeniu użycia w Edge |
| `src/lib/library/watermark.server.ts` | brak w przeglądarce | `tnb-library-admin` | logika PDF pozostaje wyłącznie po stronie Edge; testy porównują wymiary/pozycję znaku, minimalną szerokość strony i producer marker; pełny test wizualny PDF nadal wymagany |
| `src/lib/media.functions.ts` | `src/lib/api/media.ts` | `tnb-media` / `tnb-media-admin` | rozdzielić publiczne i administracyjne akcje |
| `src/lib/meetings-notify.server.ts` | `src/lib/api/meetings.ts` | `tnb-meetings` / `tnb-notifications` | sprawdzić harmonogram i status wysyłki |
| `src/lib/meetings.functions.ts` | `src/lib/api/meetings.ts` | `tnb-meetings` | porównać CRUD i role |
| `src/lib/newsletter.functions.ts` | `src/lib/api/newsletter.ts` | `tnb-newsletter` | porównać double opt-in i wypis |
| `src/lib/notifications-test.server.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | testowe wysyłki; sprawdzić dostęp wyłącznie admin |
| `src/lib/notifications.functions.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | porównać akcje i odbiorców |
| `src/lib/notifications.server.ts` | `src/lib/api/notifications.ts` | `tnb-notifications` | provider/sekrety; obecnie tryb testowy |
| `src/lib/orders.functions.ts` | `src/lib/api/orders.ts` | `tnb-orders` | porównać statusy i idempotencję |
| `src/lib/orders.server.ts` | `src/lib/api/orders.ts` | `tnb-orders` | porównać operacje uprzywilejowane |
| `src/lib/pages.functions.ts` | `src/lib/api/pages.ts` | `tnb-pages` | testy publikacji istnieją; sprawdzić uprawnienia |
| `src/lib/payments.functions.ts` | `src/lib/api/payments.ts` | `tnb-payments` | testy podpisów Edge; pełne testy webhooków i refundów wymagane |
| `src/lib/payments/providers.server.ts` | `src/lib/api/payments.ts` | `tnb-payments` | przeniesiono współdzielone podpisy do Edge; porównać pełną konfigurację |
| `src/lib/platform.functions.ts` | `src/lib/api/platform.ts` | `tnb-platform` | test least-privilege istnieje; sprawdzić role i kolumny |
| `src/lib/podcast.functions.ts` | `src/lib/api/podcast.ts` | `tnb-podcast` | porównać publikację i dostęp |
| `src/lib/recommend.functions.ts` | `src/lib/api/recommend.ts` | `tnb-recommend` | porównać reguły i limity |
| `src/lib/templates.functions.ts` | `src/lib/api/templates.ts` | `tnb-templates` | porównać operacje szablonów |
| `src/lib/users.functions.ts` | `src/lib/api/users.ts` | `tnb-users` | role i operacje admin wymagają testów |
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
