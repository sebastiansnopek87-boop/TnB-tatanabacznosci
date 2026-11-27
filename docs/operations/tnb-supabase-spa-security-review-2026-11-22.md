# TNB — kontrola bezpieczeństwa Supabase i bramek SPA

Data: 2026-11-22  
Projekt Supabase: `pmdfiipontreuclfumdh`  
Zakres: odczytowy audyt advisorów, ACL funkcji SQL, RLS oraz kluczowych bramek React SPA.

## 1. Supabase Security Advisor — ustalenia i interpretacja

Odczyt advisorów zwrócił następujące grupy:

- 3 tabele z RLS włączonym bez polityk: `instagram_secret`, `youtube_secret`, `payment_webhook_events`.
- 8 funkcji `SECURITY DEFINER` wykonywalnych przez `anon`.
- 13 funkcji `SECURITY DEFINER` wykonywalnych przez `authenticated`.
- 1 rozszerzenie `pg_net` w schemacie `public`.

### 1.1 Tabele bez polityk — dostęp serwerowy

Sprawdzono migrację `20261115153232_revoke_client_access_from_server_only_tables.sql`. Odbiera ona uprawnienia tabel `PUBLIC`, `anon` i `authenticated`, pozostawiając je `service_role`. Brak polityk RLS dla tych tabel jest zamierzony i jest dodatkową barierą. Nie dodawać polityk tylko po to, aby uciszyć advisor.

### 1.2 Funkcje SECURITY DEFINER — rozróżnienie intencji od ryzyka

Sprawdzono definicje i ACL ośmiu funkcji oznaczonych przez advisor jako dostępne dla anon:
- `article_is_public` — zwraca boolean dla opublikowanego artykułu;
- `article_stats` — zwraca statystyki wyłącznie dla publicznego artykułu lub administratora;
- `community_feed` i `community_feed_filtered` — anon otrzymuje wyłącznie posty publiczne; limity paginacji są ograniczone do 50;
- `community_post_stats` — tylko publiczny post;
- `community_search` — wyniki ograniczone do opublikowanych postów, a anon dodatkowo do publicznej widoczności; zapytanie ograniczone do 80 znaków;
- `community_sector_counts` — liczy wyłącznie opublikowane posty publiczne;
- `library_can_read` — zwraca wynik kontroli dostępu do konkretnego materiału, nie zawartość pliku.

Migracja `20261122193543_harden_public_rpc_execute_grants.sql` usuwa grant `PUBLIC` i jawnie przyznaje dostęp tylko wskazanym rolom. Dla `article_poll_open` odbiera dostęp `anon` i pozostawia go zalogowanym. Advisor wykrywa jawny grant dla `anon`, ale w tych przypadkach jest to zgodne z opisanym publicznym przeznaczeniem RPC. Nie należy masowo odbierać tych grantów bez testów funkcji publicznych.

Osobno sprawdzono `has_role(uuid, app_role)`: funkcja wiąże przekazany identyfikator z `auth.uid()` i wymaga zalogowanego użytkownika. Migracja usuwa jej wykonanie przez `anon`.

### 1.3 Rozszerzenie pg_net

Advisor zgłasza `pg_net` w schemacie `public`. Nie przenosić rozszerzenia automatycznie: najpierw trzeba sprawdzić zależności obiektów, wywołania i zgodność z aktualnym środowiskiem Supabase. To zadanie porządkowe, nie dowód samodzielnego wycieku danych.

## 2. Performance Advisor

Odczyt zwrócił:
- 94 ostrzeżenia `auth_rls_initplan`: wywołania `auth.uid()` / `current_setting()` w politykach mogą być przeliczane dla każdego wiersza;
- 10 ostrzeżeń `multiple_permissive_policies`: kilka polityk dopuszczających tę samą rolę i operację;
- 29 nieużywanych indeksów.

Nie wykonywać masowej przebudowy RLS ani usuwania indeksów. Dla `auth_rls_initplan` można przygotować kontrolowane zamiany na `(select auth.uid())` i `(select auth.<function>())`, ale każda migracja musi zachować semantykę polityki i przejść testy ról anon/authenticated/admin. W przypadku wielu polityk trzeba sprawdzić, czy łączenie OR jest zamierzone. Nieusuwane indeksy mogą być potrzebne rzadkim ścieżkom administracyjnym lub FK.

## 3. Kontrola bramek React SPA

Sprawdzone pliki:
- `src/routes/_authenticated/route.tsx` — przed wejściem na trasę wywołuje `supabase.auth.getUser()`; brak poprawnego użytkownika przekierowuje do `/auth`.
- `src/routes/_authenticated/admin.tsx` — pobiera status administratora przez `getAdminStatus`; w razie braku uprawnień wyświetla „Brak dostępu” i pozwala się wylogować.
- `src/components/tnb/MaintenanceGate.tsx` — tryb przedpremierowy pokazuje stronę zapowiedzi niezalogowanym i nieadministratorom; trasy admin/auth/reset/API są wyłączone z blokady, by administrator mógł się zalogować.
- `src/components/tnb/ModuleGate.tsx` — blokuje ukryte moduły, pozostawiając dostęp do stron dostawy i tokenowych rezerwacji.

To są bramki interfejsu. Nie zastępują RLS ani autoryzacji w Edge Functions. Kontrola statyczna potwierdza obecność bramek, ale nie jest testem E2E dla każdej roli.

## 4. Zamówienia — potwierdzony brak idempotencji żądania

W `src/lib/api/orders.ts` kontrakt `CreateOrderInput` nie zawiera klucza idempotencji. `createLibraryOrder` przekazuje do Edge Function tylko dane zamówienia. W `supabase/functions/tnb-orders/index.ts` zamówienie jest tworzone przed wywołaniem operatora. Brak trwałego klucza ponowienia po stronie klienta i bezpiecznej obsługi równoległego retry pozostaje problemem P1.

Nie dodano kolumny ani indeksu w tej kontroli. Poprawna implementacja wymaga:
1. stabilnego UUID generowanego dla jednej próby zakupu i zachowywanego przy retry;
2. fingerprintu znormalizowanych danych (materiał, metoda, dane kupującego, kwota/currency po stronie serwera);
3. unikalnego ograniczenia na użytkownika/gościa i klucz;
4. atomowej rezerwacji próby oraz lease/lock, aby dwa równoległe żądania nie uruchomiły dwóch transakcji;
5. odtworzenia poprzedniego wyniku, bez tworzenia nowego zamówienia;
6. obsługi sytuacji, gdy operator utworzył transakcję, ale odpowiedź nie dotarła do aplikacji.

Samo `upsert` lub sam indeks unikalny nie rozwiązuje bezpiecznie równoległych wywołań operatora.

## 5. Decyzje i następne kroki

- Nie znaleziono podstaw do masowego cofnięcia publicznych RPC: sprawdzone funkcje mają ograniczone zakresy danych, a migracja świadomie zachowuje publiczne odczyty.
- Tabele sekretów i zdarzeń webhooków pozostają bez polityk i bez bezpośrednich uprawnień klienta.
- Do przygotowania osobna, testowana seria optymalizacji RLS.
- Do zaprojektowania i przetestowania pełny kontrakt idempotencji zamówień.
- Nie wykonano zmian produkcyjnych, migracji, wdrożeń Edge Functions ani zmian trybu przedpremierowego.
