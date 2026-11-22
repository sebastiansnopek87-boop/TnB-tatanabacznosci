# TNB — audyt rozbieżności produkcyjnych płatności

Data kontroli: 2026-11-22  
Repozytorium: `sebastiansnopek87-boop/TnB-tatanabacznosci`  
Gałąź odniesienia: `main`  
Projekt Supabase: `pmdfiipontreuclfumdh`

## Zakres i ograniczenia

Kontrola objęła odczyt źródeł funkcji wdrożonej w Supabase, porównanie z kodem na `main`, metadane tabel i indeksów, polityki RLS oraz konfigurację operatorów. Nie wykonywano transakcji testowych, nie wysyłano webhooków, nie zmieniano danych, sekretów ani konfiguracji operatorów. To audyt statyczny i odczytowy, nie certyfikacja integracji płatniczych.

## Ustalenia

### P1 — wdrożona funkcja `tnb-payments` jest starsza od kodu w repozytorium

- Produkcyjna funkcja ma status `ACTIVE`, wersję `1`.
- Plik produkcyjny `index.ts` ma 22 109 znaków; plik na `main` ma 23 396 znaków.
- Kod na `main` importuje `providerReferenceMatches` z `../_shared/payment-webhook.ts` i przed zmianą statusu zamówienia wymaga zapisanej referencji operatora oraz jej zgodności z referencją z webhooka.
- W pobranym kodzie produkcyjnym nie ma tego importu ani kontroli `order.provider_ref`.
- W konsekwencji produkcja nie korzysta z dodatkowego zabezpieczenia, które już znajduje się w repozytorium. Nie oznacza to samo w sobie, że webhook można sfałszować — adapter nadal weryfikuje podpis — ale produkcja nie egzekwuje dodatkowego powiązania zdarzenia z referencją zapisaną przy zamówieniu.
- Nie wdrażać tej funkcji w ciemno. Najpierw uruchomić testy jednostkowe adapterów, testy poprawnego/błędnego podpisu, zgodności referencji, kwoty, waluty, środowiska i powtórzonego zdarzenia. Następnie wykonać kontrolowane wdrożenie pojedynczej funkcji.

### P1 — brak idempotencji żądania tworzącego zamówienie

W aktualnym `tnb-orders` operacja `createLibraryOrder` wstawia nowe zamówienie przed wywołaniem operatora. Schemat tabeli `library_orders` ma unikalne ograniczenia dla numeru zamówienia, tokenu dostępu, identyfikatora sesji checkout i pary operator/referencja. Nie ma jednak osobnego klucza idempotencji żądania klienta.

Powtórzenie żądania może więc utworzyć kolejne zamówienie zanim aplikacja otrzyma odpowiedź. Naprawa wymaga uzgodnienia kontraktu klient–Edge Function, trwałego klucza idempotencji, obsługi równoległych żądań i stanów przerwanego checkoutu. Nie dodawać wyłącznie indeksu bez obsługi ponownego odczytu istniejącego wyniku.

### P1 — identyfikator webhooka ma globalny klucz unikalności

Tabela `payment_webhook_events` ma klucz główny wyłącznie na `event_id`. Wiersz przechowuje też środowisko i typ, ale nie są one częścią klucza. Przed zmianą schematu trzeba potwierdzić format identyfikatorów wszystkich operatorów i wykluczyć kolizje pomiędzy operatorami lub środowiskami. Ewentualna zmiana wymaga migracji kompatybilnej wstecz i testu ponowień.

### P2 — bramki płatności są obecnie wyłączone

Odczyt tabeli `payment_providers` wykazał:
- `p24`: disabled, sandbox, brak danych merchant/pos/client;
- `tpay`: disabled, sandbox, brak danych merchant/pos/client;
- `payu`: disabled, sandbox, brak danych merchant/pos/client.

Na podstawie tej konfiguracji nie ma podstaw do uznania sprzedaży online za gotową. Nie włączać operatora ani środowiska live bez danych dostępowych właściciela i testów sandbox.

### P2 — e-mail pozostaje w trybie testowym

`email_settings.delivery_mode = test`; `newsletter_notifications_enabled = false`. Wcześniejsze ustalenia wskazują również, że wysyłka newslettera nie została uruchomiona. Nie deklarować działających powiadomień do klientów, dopóki dostawca SMTP/API, domena nadawcy i rzeczywisty test dostarczenia nie zostaną potwierdzone.

### Kontrola RLS

W tabelach `library_orders`, `payment_webhook_events`, `library_order_events`, `payment_providers` i `email_notification_log` RLS jest włączone. Polityki odczytu ograniczają zamówienia i zdarzenia do administratorów oraz — dla zamówień — do właściciela. Dane operatorów mogą odczytywać administratorzy. Nie znaleziono polityk zapisu dla ról użytkowników w tych tabelach; zapis obsługują funkcje backendowe z uprzywilejowanym klientem. Wymaga to dalszych testów integracyjnych, ale w tej kontroli nie stwierdzono otwartej polityki zapisu dla `anon` lub zwykłego `authenticated`.

## Plan naprawczy

1. Przygotować testy kontraktowe dla adapterów P24/Tpay/PayU i wspólnej logiki webhooków.
2. Przenieść kontrolę zgodności referencji z `main` do produkcji jako osobne, kontrolowane wdrożenie po pozytywnych testach.
3. Zaprojektować klucz idempotencji `createLibraryOrder` i bezpieczną obsługę retry/timeout.
4. Zdecydować, czy identyfikator webhooka wymaga klucza złożonego (operator + środowisko + event ID), po sprawdzeniu specyfikacji operatorów.
5. Dopiero po tych krokach skonfigurować sandboxowe dane operatorów i wykonać pełne transakcje testowe.
6. Osobno skonfigurować dostawcę poczty i wykonać test dostarczenia.

## Decyzja bezpieczeństwa

Nie wykonywać teraz zmian w produkcyjnej funkcji płatniczej, schemacie webhooków ani ustawieniach operatorów. Najpierw przygotować i przejść testy. Tryb przedpremierowy pozostaje aktywny.
