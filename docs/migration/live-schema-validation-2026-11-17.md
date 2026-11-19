# Walidacja źródeł migracji i zgodności schematu Supabase

Data odczytu: 2026-11-17  
Projekt Supabase: `pmdfiipontreuclfumdh`  
Gałąź: `chore/restore-supabase-migrations-20261117`

## Zakres i wynik kontroli

Kontrola była wyłącznie odczytowa. Nie uruchamiano migracji, nie zmieniano danych, polityk RLS, sekretów ani funkcji na produkcyjnej bazie.

- Historia migracji Supabase: 66 wpisów.
- Pliki migracji w gałęzi odzyskiwania: 66; wersje i nazwy odpowiadają odczytanej historii.
- Tabele schematu `public`: 60.
- Tabele ujęte w wygenerowanym typie TypeScript: 60; brak tabelujących nazw po obu stronach porównania.
- Typy TypeScript wygenerowane bezpośrednio z bieżącego Supabase są identyczne z plikiem `src/integrations/supabase/types.ts` na tej gałęzi (3126 linii).
- Funkcje publiczne ujęte w wygenerowanych typach: 20. Wykryta wcześniej brakująca deklaracja `get_tnb_cron_secret()` została dodana i ponownie zweryfikowana.
- CI dla commita synchronizującego typy `074bb71b9fbce75f57d8dcc7e7bcec79c3c58bdc`: PASS (build, SPA fallback, TypeScript, SPA boundary, Edge Function source/config coverage, unit tests, secrets scan i lint).

## Kontrola funkcji i uprawnień

Odczyt katalogu PostgreSQL potwierdził:

- `admin_set_user_role(uuid, uuid, app_role, boolean)`: SECURITY DEFINER, `search_path=public, pg_temp`, EXECUTE wyłącznie dla `service_role` (poza właścicielem).
- `get_tnb_cron_secret()`: SECURITY DEFINER, pusty `search_path`, EXECUTE wyłącznie dla `service_role` (poza właścicielem).
- `community_post_visible(uuid)`: EXECUTE dla `authenticated` i `service_role`, bez `anon`.
- `has_role(uuid, app_role)`: EXECUTE dla `authenticated` i `service_role`, bez `anon`; implementacja wiąże sprawdzany identyfikator z `auth.uid()`.

Trzy tabele bez polityk RLS to `instagram_secret`, `youtube_secret` i `payment_webhook_events`. Odczyt ACL potwierdził odebranie uprawnień `PUBLIC`, `anon` i `authenticated` oraz zachowanie dostępu `service_role` zgodnie z migracją 0062.

## Kontrola harmonogramu

W katalogu produkcyjnej bazy znajdują się aktywne zadania:

- `tnb-consult-reminders`: co 15 minut.
- `tnb-instagram-sync`: co 30 minut.

Istnieje wpis Vault o nazwie `TNB_CRON_SECRET`. Wartość sekretu nie była odczytywana ani zapisywana w raporcie.

## Ograniczenia i decyzja

To potwierdza zgodność nazw i wersji historii migracji, zgodność listy tabel oraz typów klienta z aktualnym schematem i wybrane właściwości bezpieczeństwa. Nie dowodzi, że odzyskana treść wszystkich 65 historycznych plików SQL jest bajtowo identyczna z SQL wykonanym w przeszłości na produkcji.

Nie wykonano pełnego `supabase db reset` na izolowanej bazie. Do takiego testu potrzebne jest oddzielne środowisko, które odtworzy wszystkie migracje od pustej bazy. Nie wolno wykonywać tego testu na produkcji.

**Decyzja:** PR może przejść do dalszego review kodu, ale nie jest jeszcze zatwierdzony do scalania ani do użycia jako gwarantowany zestaw odtwarzania nowej bazy. Wymagane pozostaje odtworzenie na czystej, izolowanej bazie i porównanie schematu po migracji.
