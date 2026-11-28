# Zakres migracji modułu płatności do React SPA

## Cel etapu migracji

Moduł płatności ma zostać przeniesiony do React SPA i przygotowany do późniejszego uzupełnienia danych sprzedawcy oraz konfiguracji operatora. Weryfikacja rzeczywistych transakcji i integracji z operatorami następuje dopiero po wdrożeniu aplikacji na produkcję.

Brak danych operatora lub sekretów nie może blokować ukończenia migracji React SPA.

## Wymagany zakres po stronie SPA

- Widoki administracyjne konfiguracji płatności i statusu przygotowania operatorów.
- Adaptery klienta korzystające wyłącznie z Supabase Edge Functions; bez importowania kodu serwerowego TanStack Start.
- Obsługa konfiguracji operatorów przez bezpieczny interfejs: identyfikatory niebędące sekretami mogą być zapisywane zgodnie z uprawnieniami, a sekrety pozostają wyłącznie w środowisku serwerowym Supabase.
- Rozdzielenie konfiguracji operatora, środowiska sandbox/live i statusu gotowości.
- Możliwość późniejszego podłączenia kolejnych operatorów przez wspólny kontrakt adaptera, bez wiązania widoków SPA z API konkretnego dostawcy.
- Jawny stan „oczekuje na konfigurację” / „nie skonfigurowano”. Brak danych nie może być przedstawiany jako poprawnie przetestowana integracja.
- Bezpieczne domyślne zachowanie: operatorzy pozostają wyłączeni i niedomyślni, dopóki nie zostaną skonfigurowani i świadomie aktywowani.

## Granica tego etapu

Na etapie migracji SPA nie wymagamy:
- rzeczywistego obciążenia karty lub rachunku;
- produkcyjnych danych merchant/POS/client;
- sekretów API operatorów;
- pozytywnego testu połączenia z produkcyjnym operatorem;
- testów pełnego cyklu transakcji, zwrotów i webhooków na produkcji.

Nie wolno w tym celu wykonywać próbnych obciążeń, zmieniać sekretów produkcyjnych ani aktywować operatora live.

## Testy wymagane przed zamknięciem migracji SPA

- Testy jednostkowe i kontraktowe adaptera SPA: kształt żądań, obsługa błędów, brak sesji, 401/403 i puste odpowiedzi.
- Testy widoków: stan nie skonfigurowany, brak sekretów, role admin/superadmin, walidacja pól i brak ujawniania sekretów.
- Testy build/typecheck oraz kontrola, że ścieżki aplikacji nie importują modułów `.functions.ts` / `.server.ts` TanStack Start.
- Potwierdzenie, że przepływ checkout w SPA komunikuje się z Edge Function i poprawnie prezentuje stan oczekiwania na konfigurację, bez deklarowania rzeczywistej płatności.

Testy te weryfikują gotowość architektury i zachowanie SPA. Nie są dowodem poprawności transakcji u operatora.

## Testy po wdrożeniu na produkcję

Dopiero po wdrożeniu aplikacji na CyberFolks i przekazaniu danych operatora należy przeprowadzić testy sandbox/live zgodnie z osobnym planem: autoryzacja operatora, utworzenie transakcji, powrót klienta, podpis i walidacja webhooka, idempotencja, zgodność kwoty/waluty, nadanie dostępu, ponowienia, błędy i zwroty. Aktywacja live wymaga osobnej, świadomej konfiguracji i potwierdzenia.

## Aktualny punkt odniesienia w repozytorium

- SPA adapter: `src/lib/api/payments.ts`.
- Edge Function: `supabase/functions/tnb-payments/index.ts` oraz adaptery w `supabase/functions/tnb-payments/providers.ts`.
- Legacy Start handler: `src/lib/payments.functions.ts`.
- Legacy adaptery serwerowe: `src/lib/payments/providers.server.ts`.

Obecność adaptera SPA i Edge Function nie oznacza jeszcze, że cały moduł administracyjny został odłączony od legacy Start. Przed usunięciem plików legacy trzeba potwierdzić wszystkie importy, przenieść UI i testy kontraktowe, a następnie sprawdzić build i CI.

## Kryterium ukończenia

Migracja płatności na tym etapie jest ukończona, gdy cały interfejs i przepływ aplikacyjny działają w React SPA, komunikacja przebiega przez Edge Function, konfiguracja jest bezpieczna, a operatorzy pozostają nieaktywni do czasu otrzymania danych. Pełna walidacja transakcyjna jest osobnym etapem po wdrożeniu produkcyjnym.


## Bramka aktywacji przed wdrożeniem

W kodzie Edge Functions `tnb-orders` i `tnb-payments` obowiązuje fail-closed flaga środowiskowa `TNB_PAYMENTS_OPERATIONS_ENABLED`. Brak wartości `true` oznacza:
- checkout online nie zwraca aktywnych operatorów i odrzuca próbę utworzenia płatności;
- nie można włączyć operatora ani ustawić go jako domyślnego;
- test połączenia nie wykonuje żądania do zewnętrznego operatora;
- nie można przełączyć operatora na środowisko live.

Po wdrożeniu React SPA, uzupełnieniu danych i przygotowaniu testów należy świadomie ustawić tę flagę na `true` w konfiguracji Supabase Edge Functions. Sama obecność danych sprzedawcy nie aktywuje płatności.
