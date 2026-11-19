# Zamówienia i płatności — audyt idempotencji oraz dostaw

Data audytu: 2026-11-16  
Zakres: odczyt kodu gałęzi `chore/legacy-runtime-audit` oraz odczyt schematu aktywnego projektu Supabase `pmdfiipontreuclfumdh`.  
Tryb: wyłącznie odczyt. Nie wykonano migracji, zapisów w bazie, zmian sekretów ani testowych płatności.

## Stan potwierdzony w kodzie

### Tworzenie zamówienia

- React SPA wywołuje `tnb-orders` przez `src/lib/api/orders.ts`.
- Payload `createLibraryOrder` zawiera slug, imię i nazwisko, e-mail, telefon, metodę i zgodę. Nie zawiera klucza idempotencji.
- Edge Function pobiera cenę i walutę z opublikowanego materiału, następnie tworzy nowy rekord `library_orders` przed wywołaniem operatora.
- Każde ponowione żądanie tworzy nowy rekord. Brak unikalnego klucza żądania oznacza brak ochrony przed podwójnym zamówieniem.
- Po utworzeniu transakcji zapisywane są `provider_ref` i `checkout_session_id`, ale nie jest zapisywany URL checkoutu.
- Błąd lub timeout po stronie operatora jest traktowany jak niepowodzenie. Nie ma rozróżnienia między jednoznacznym odrzuceniem a nieznanym wynikiem połączenia, w którym operator mógł już utworzyć transakcję.

### Płatność i skutki uboczne

- `tnb-payments` zapisuje zdarzenie webhooka, warunkowo zmienia status zamówienia na `paid`, a następnie osobno zapisuje historię i wywołuje `afterPaid`.
- `afterPaid` wykonuje powiadomienia i aktualizuje `delivery_status` w osobnych zapytaniach. Nie ma wspólnej transakcji DB obejmującej zmianę statusu oraz trwałe zaplanowanie dostawy.
- Błąd po zapisie statusu `paid` może pozostawić zamówienie opłacone bez ponowienia powiadomienia/dostawy.
- Ścieżki ręcznego potwierdzenia płatności i rozstrzygnięcia `needs_review` także wywołują `afterPaid`; rozwiązanie musi obsłużyć je tak samo jak webhook.
- `email_notification_log` ma unikalny indeks częściowy na `idempotency_key`. Automatyczna wiadomość po płatności używa stałego klucza `event-orderId`. Ponowne wywołanie po nieudanym lub przerwanym wysłaniu może więc zakończyć się statusem `duplicate`, bez ponownej próby.
- Ręczne ponowienie dostawy dodaje losowy suffix do klucza. To pozwala ominąć duplikat, ale nie jest trwałą kolejką retry.
- SMTP nie zapewnia semantyki exactly-once. Po utracie połączenia po przyjęciu wiadomości przez serwer nie da się bez dodatkowego mechanizmu operatora rozstrzygnąć, czy bezpiecznie wysłać ją ponownie. Docelowo można zagwarantować trwałe retry i ograniczyć duplikaty, nie absolutne exactly-once.

## Stan potwierdzony w aktywnej bazie

- `library_orders` zawiera pola statusu, referencji operatora, `checkout_session_id`, `delivery_status`, `delivery_error` i tokenu dostępu.
- Istnieją unikalne indeksy dla `order_number`, `access_token`, `checkout_session_id` oraz `(provider, provider_ref)`. Dwa indeksy `(provider, provider_ref)` mają identyczną definicję pod różnymi nazwami; to istniejąca redundancja, nie była zmieniana.
- Brakuje `idempotency_key` i hasha payloadu żądania w `library_orders`.
- `payment_webhook_events` ma klucz główny `event_id` i timestamp przyjęcia zdarzenia.
- `email_notification_log` ma unikalny częściowy indeks na `idempotency_key`, pola `attempts`, `retryable`, `status`, `reason` i zapisany render wiadomości.
- Nie znaleziono tabeli outbox, kolejki ani tabeli dostaw.
- RLS: `library_orders` — użytkownik czyta własne zamówienia, admin czyta zamówienia; `email_notification_log` — admin SELECT. Brak polityk dla `payment_webhook_events` w odczytanym wyniku.
- W chwili audytu tabele `library_orders` i `email_notification_log` nie zawierały rekordów. Nie wykonano żadnych zmian w tych tabelach.

## Istotna rozbieżność migracji

Gałąź repozytorium zawiera obecnie tylko jeden plik w `supabase/migrations` (`20261116100000_tnb_cron_jobs.sql`). Aktywna baza ma znacznie bogatszą historię `supabase_migrations.schema_migrations` — co najmniej 40 ostatnich wersji, z których najnowsza to `20261116142112`.

To oznacza, że katalog migracji w repo nie jest kompletnym, odtwarzalnym zapisem schematu aktywnej bazy. **Nie wolno teraz dopisywać i uruchamiać migracji idempotencji/outbox w produkcyjnej bazie, dopóki nie zostanie uzgodniony brakujący łańcuch migracji i źródło prawdy dla schematu.** W przeciwnym razie repo i produkcja będą się dalej rozjeżdżać.

## Docelowy projekt — kolejność wdrożenia

### 1. Uzgodnić schemat i migracje

- Porównać wszystkie wersje z `supabase_migrations.schema_migrations` z historią i plikami w repo.
- Odtworzyć brakujące migracje lub przygotować zatwierdzony baseline/schema snapshot bez ponownego wykonywania historycznych zmian na produkcji.
- Wygenerować typy Supabase z uzgodnionego schematu.
- Dopiero potem przygotować migrację rozszerzającą `library_orders` i dodającą outbox.

### 2. Idempotencja żądania zakupu

- SPA generuje UUID dla pojedynczej próby zakupu i zachowuje go przy ponowieniu tego samego żądania.
- Edge Function waliduje UUID; w bazie przechowywany jest hash klucza, a nie surowa wartość.
- Hash kanonicznego payloadu obejmuje produkt, metodę, znormalizowany e-mail i dane kupującego; cena nadal pochodzi wyłącznie z bazy.
- Unikalny indeks wymusza jeden rekord dla klucza. Ten sam klucz i ten sam hash zwracają istniejące zamówienie; ten sam klucz i inny hash zwracają HTTP 409.
- Utworzenie zamówienia oraz przejęcie prawa do inicjowania checkoutu musi być atomowe. Nie wolno wykonywać dwóch równoległych wywołań operatora dla jednego zamówienia.
- Trzeba przechowywać bezpieczny stan checkoutu i wynik operatora. Nie wolno zwracać istniejącego zamówienia jako gotowego, jeżeli URL checkoutu nie został zapisany.
- Nieznany wynik połączenia z operatorem nie może automatycznie tworzyć kolejnej transakcji. Najpierw wymagane jest uzgodnienie transakcji po stabilnej referencji zamówienia albo oznaczenie jej do ręcznej weryfikacji.

### 3. Trwały outbox dla skutków płatności

- Jedna funkcja SQL/RPC w transakcji DB wykonuje warunkową zmianę statusu na `paid` i zapisuje wymagane zdarzenia outbox.
- RPC ma obsłużyć webhook, ręczne potwierdzenie przelewu i zatwierdzenie po `needs_review`.
- Outbox ma unikalny klucz zdarzenia, status, liczbę prób, `next_attempt_at`, lease/lock, `last_error` oraz timestampy.
- Worker pobiera zadania atomowo (lease / `SKIP LOCKED`), wykonuje dostawę i oznacza wynik. Wygasły lease umożliwia odzyskanie pracy po awarii.
- Wiadomości i dostawa dostępu muszą mieć oddzielne, stabilne klucze idempotencji. Ręczne ponowienie ma być osobnym, audytowanym zdarzeniem.
- `delivery_status=sent` może być ustawione dopiero po potwierdzonym sukcesie SMTP; symulacja testowa nie jest dostarczeniem.
- Retry SMTP będzie at-least-once. Należy obsłużyć status `sending` z wygasłym lease i jawnie oznaczać przypadki niejednoznacznego wyniku.

### 4. Testy przed wdrożeniem

- równoległe żądania z tym samym kluczem: jeden order i maksymalnie jedna inicjacja checkoutu;
- ten sam klucz z innym payloadem: 409 bez nowego orderu;
- timeout przed i po utworzeniu transakcji u operatora;
- webhook powtórzony, spóźniony i równoległy;
- awaria po zmianie statusu, ale przed obsługą outbox;
- worker przerwany w trakcie zadania i odzyskanie po lease;
- idempotencja dla webhooka, admin-paid, review-paid i ręcznego resend;
- testy RLS, brak ujawnienia checkout URL i tokenów innym użytkownikom;
- regresja istniejących ścieżek P24/Tpay/PayU i zakupów gościa/użytkownika.

## Bramy bezpieczeństwa

- Ten audyt jest read-only. Nie zastosowano żadnej migracji ani nie zmieniono danych.
- PR #11 pozostaje Draft; nie wykonano merge.
- Nie można uznać dostawy e-mail za produkcyjnie sprawdzoną — aktywne ustawienie wiadomości pozostaje w trybie testowym, a sekrety SMTP nie są skonfigurowane.
- Nie można uznać wdrożenia CyberFolks ani pełnego E2E produkcji za zweryfikowane.


## Aktualizacja prac — 2026-11-19

- Przywrócony łańcuch 66 migracji i wygenerowane typy z `main` zostały zsynchronizowane z gałęzią migracji przez zwykły merge commit `e5c8518a97a019308df42c75fa66b301184dc897`. Gałąź nie jest już za `main`; merge-base to `454aeb3c0f3de07d7a262e1707ce3600485226ea`.
- PR #11 pozostaje Draft i nie został scalony. Nie wykonano migracji ani zapisów w produkcyjnej bazie.
- Odczyt schematu aktywnej bazy potwierdza, że `library_orders` nadal nie ma `idempotency_key` ani `payload_hash`; nie znaleziono triggerów na tej tabeli. Nadal istnieją unikalne indeksy `checkout_session_id` i `(provider, provider_ref)`.
- Nie znaleziono workflow run dla nowego merge commit w GitHub Actions. Wynik wcześniejszego CI PASS dotyczy poprzedniego HEAD `b8a2916`, a nie nowego merge commita. Przed scaleniem wymagany jest nowy zielony przebieg.
- Kolejny kodowy krok pozostaje zablokowany przez potrzebę dodania i przetestowania schematu idempotencji/outbox jako wersjonowanej migracji. Nie wolno stosować zmian DDL bezpośrednio do aktywnej bazy. Migracja musi być odtwarzalna na czystej bazie i dopiero potem porównana z live schema.

## Aktualizacja weryfikacji — 2026-11-19 (po synchronizacji)

- Wcześniejsza sekcja „Istotna rozbieżność migracji” opisuje stan z 2026-11-16. Nie jest już aktualnym opisem zawartości gałęzi: przywrócono 66 plików migracji z `main`, a gałąź PR #11 została zsynchronizowana z `main` merge commitem `e5c8518a97a019308df42c75fa66b301184dc897`.
- Potwierdzono CI na aktualnym HEAD `6a9e11226b5ca9705f855baff54addd60114ab06`: GitHub Actions Build #628 / run `44446256055` — PASS. Wszystkie kroki zakończone sukcesem, w tym build, TypeScript, testy jednostkowe, izolacja legacy runtime i skan buildu.
- Ponowny odczyt `supabase/functions/tnb-orders/index.ts` potwierdza, że `createLibraryOrder` nadal wykonuje zwykły INSERT do `library_orders` przed wywołaniem operatora. Nie przyjmuje klucza idempotencji, nie ma atomowego claimu checkoutu ani trwałego rozróżnienia wyniku niejednoznacznego po timeout.
- Nie wdrożono jeszcze idempotencji ani outbox. Nie wykonano DDL ani zapisów do aktywnej bazy.
- Następny bezpieczny krok implementacyjny wymaga utworzenia migracji przez Supabase CLI w środowisku repozytorium, wygenerowania typów i wykonania czystego replay wszystkich migracji. W tym środowisku nie ma dostępnego CLI/replay, dlatego nie należy tworzyć pozornie zweryfikowanej migracji ani podłączać kodu do nieistniejących kolumn/RPC.
- Po dostarczeniu walidowalnej migracji kolejność pozostaje: test czystego replay → testy RPC/konkurencji → adapter Edge Function → testy operatorów sandbox → osobny przegląd i zgoda na wdrożenie.

## Weryfikacja zgodności Edge Functions z produkcją — 2026-11-19

Odczytano wdrożone funkcje Supabase `tnb-orders` i `tnb-payments` (obie ACTIVE, version 1) i porównano ich `index.ts` z plikami na gałęzi `chore/legacy-runtime-audit`. Porównanie jest tekstowe, nie jest testem wykonania.

- `tnb-orders/index.ts`: wdrożony plik ma 31 866 znaków, repozytoryjny 34 185; pliki nie są identyczne. Pierwsza różnica dotyczy importu SMTP: repozytorium importuje `sendSmtpMail` i `smtpConfig` z `../_shared/smtp.ts`, wdrożona wersja tego importu nie ma.
- `tnb-payments/index.ts`: wdrożony plik ma 22 109 znaków, repozytoryjny 23 396; pliki nie są identyczne. Pierwsza różnica dotyczy importu `providerReferenceMatches` z `../_shared/payment-webhook.ts`, obecnego w repozytorium, a nieobecnego w wdrożonej wersji.
- Obie wdrożone funkcje mają `verify_jwt=false`. To ustawienie pozostaje bez zmian; przed zmianą wymaga osobnego przeglądu modelu autoryzacji i obsługi webhooków.
- Obie funkcje są aktywne. Nie wdrożono żadnej zmiany w Supabase podczas tego audytu.

Wniosek: produkcyjny kod Edge Functions jest starszy/różny względem aktualnego repozytorium. To jest osobna blokada wdrożenia, niezależna od CI React SPA. Nie wolno uznać testów CI repozytorium za dowód, że te zmiany już działają w produkcji. Przed wdrożeniem trzeba przejrzeć pełny diff funkcji i ich zależności, sprawdzić konfigurację `verify_jwt`, wykonać testy sandbox oraz zaplanować wdrożenie każdej funkcji osobno z kontrolą logów i rollbackiem.

## CI po aktualizacji dokumentu

- Commit `7708dc1d4d0a1d8114da28765185eb09332c8cd5` ma Build #629 / run `44461228452`: **PASS**.
- Ten run potwierdza testy repozytorium po aktualizacji dokumentu. Nie jest dowodem zgodności ani wdrożenia Edge Functions.
