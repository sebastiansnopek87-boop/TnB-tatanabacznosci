# TNB — audyt kompleksowy i plan przywrócenia zgodności

Data: 2026-11-22  
Repozytorium: `sebastiansnopek87-boop/TnB-tatanabacznosci`  
Gałąź bazowa: `main`  
Commit bazowy audytu: `0b9dc6d88929225b99e55271583611d29acc5357`  
Kopia sprzed migracji: `backup/pre-spa-migration-2026-11-15`  
Commit kopii: `7cff0305b9e39672319d87fd876fd47df0ac5b1f`  
Supabase: `pmdfiipontreuclfumdh` (eu-west-3)  
CodeMindAI project: `ea7c8d4c-51d1-4e17-8dcf-4b2fd36c9167`

## 1. Zasady bezpieczeństwa

- Produkcyjna baza i dane pozostają nietknięte podczas audytu i testów.
- Nie wykonujemy resetu produkcyjnej bazy ani odtwarzania migracji na produkcji.
- Nie wdrażamy zbiorczo Edge Functions.
- Nie zmieniamy sekretów, konfiguracji operatorów płatności ani ustawień SMTP bez osobnego testu.
- Zmiany wprowadzamy na gałęziach roboczych, przez PR, CI i przegląd.
- Tryb przedpremierowy TNB pozostaje aktywny do czasu osobnej decyzji o publikacji.

## 2. Potwierdzony stan repozytorium

Porównanie drzewa plików kopii z `main`:

| Wskaźnik | Kopia sprzed SPA | Aktualne main |
|---|---:|---:|
| Pliki w repozytorium | 500 | 710 |
| Pliki tras w `src/routes` | 72 | 60 |
| Pliki `.functions.ts` / `.server.ts` w `src` | 41 | 40 |
| Middleware importujące TanStack Start | 2 | 2 |

W aktualnym repo nadal istnieją `auth-middleware.ts` i `auth-attacher.ts`, które importują `@tanstack/react-start`. W `package.json` nadal jest zależność `@tanstack/react-start`. Nie oznacza to automatycznie, że produkcyjny build wymaga serwera Start, ale migracja nie jest oczyszczona do końca.

Z kopii zniknęły m.in. serwerowy entrypoint Start, część tras API oraz plik `avatar.functions.ts`. Trasy API były kandydatami do przeniesienia do Edge Functions, ale dla każdego endpointu trzeba potwierdzić równoważny kontrakt, walidację, auth, limity i zachowanie błędów. Sama obecność Edge Function o podobnej nazwie nie jest dowodem równoważności.

## 3. Stan usług

- Supabase: `ACTIVE_HEALTHY`, PostgreSQL 17.11.
- Schemat public: 60 tabel w ostatnim odczycie walidacyjnym.
- Historia migracji w aktywnej bazie obejmuje migracje do `newsletter_subscriber_first_name`; dokładny łańcuch trzeba utrzymywać zgodny z plikami repo.
- Wszystkie 29 Edge Functions były aktywne w odczycie z 22.11.
- CodeMindAI wskazuje repozytorium TNB, branch `main`, dwukierunkową synchronizację, ostatni pull zakończony powodzeniem i brak oczekujących pushy.
- Ostatni deployment: 190/190 plików, status `completed`, target zweryfikowany.
- GitHub CI dla commita `0b9dc6d`: PASS.
- Izolowany preflight CodeMindAI: PASS dla manifestu i narzędzi Node; worker nie ma Bun (`BUN_MISSING`), dlatego nie traktujemy go jako pełnego lokalnego builda.

## 4. Supabase Security Advisor — odczyt 22.11

### Uprawnienia SECURITY DEFINER

Live ACL inspection wykazał funkcje, które mają bezpośredni lub odziedziczony dostęp EXECUTE. W dziewięciu funkcjach wykryto anon EXECUTE. Po sprawdzeniu kodu i wcześniejszej dokumentacji rozróżniono dostęp celowy od nadmiarowego:

- Publiczne RPC: `article_is_public`, `article_stats`, `community_feed`, `community_feed_filtered`, `community_post_stats`, `community_search`, `community_sector_counts`, `library_can_read`. Dostęp anon/authenticated jest częścią publicznych odczytów i musi zostać zachowany.
- `article_poll_open`: przeznaczona dla zalogowanych użytkowników, a anon EXECUTE wynika z braku jawnego REVOKE. To jest konkretny nadmiarowy grant.
- `community_post_visible`, `ensure_my_identity`, `has_role`, `set_my_display_mode`: granty dla authenticated są oczekiwane i wynikają z użycia w RLS lub profilu. Nie odbierać ich.
- Funkcje triggerowe i administracyjne mają dostęp service_role-only w sprawdzonym ACL.

### Tabele bez polityk RLS

`instagram_secret`, `payment_webhook_events`, `youtube_secret` mają RLS włączone, bez polityk. Live ACL potwierdził brak SELECT/INSERT dla anon i authenticated oraz SELECT dla service_role. Nie dodawać polityk klienckich.

### Pozostałe alerty

- `pg_net` znajduje się w schemacie public. Przeniesienie wymaga analizy zależności i zadań cron.
- Auth leaked-password protection było oznaczone jako wyłączone w poprzednim udokumentowanym snapshotcie; aktualny stan Dashboard należy potwierdzić przed zmianą.
- 7 kluczy obcych bez indeksów pokrywających.
- 94 ostrzeżenia auth-initplan w politykach RLS.
- 24 indeksy oznaczone jako nieużywane w poprzednim snapshotcie — nie usuwać bez analizy.
- 10 tabel z wieloma permissive policies — sprawdzić, czy suma uprawnień jest zamierzona.
- Duplikat indeksów `library_orders_provider_ref` i `library_orders_provider_ref_uq` wymaga sprawdzenia zależności przed ewentualnym usunięciem.

## 5. Poczta i tryb przedpremierowy

Odczyt `email_settings` z 22.11:
- `delivery_mode = test`
- `newsletter_notifications_enabled = false`
- `newsletter_double_opt_in = false`
- `contact_notifications_enabled = true`
- `sender_domain = tatanabacznosci.pl`

Zapisy na listę oczekujących nie oznaczają, że automatyczna wiadomość o uruchomieniu platformy zostanie wysłana. Produkcyjny transport poczty i test dostarczenia pozostają do skonfigurowania.

## 6. Kolejność wdrażania

### Etap 1 — źródła, kopia i inwentaryzacja (w toku)
- [x] Potwierdzono kopię sprzed SPA i SHA commita bazowego.
- [x] Porównano drzewa plików i policzono pozostałości legacy.
- [x] Potwierdzono stan synchronizacji CodeMindAI i ostatniego deploymentu.
- [x] Odczytano Security/Performance/Health Advisors.
- [x] Zweryfikowano ACL trzech tabel bez polityk RLS.
- [x] Zweryfikowano ACL funkcji SECURITY DEFINER.
- [ ] Uzupełnić mapę 72 dawnych tras do 60 aktualnych tras oraz endpointów Edge.
- [ ] Zweryfikować każdy z 40 pozostałych plików legacy względem adaptera i funkcji Edge.

### Etap 2 — najmniejsze poprawki bezpieczeństwa (w toku)
- [x] Przygotowano migrację grant-only: jawne REVOKE PUBLIC dla publicznych RPC przy zachowaniu ich anon/authenticated grants.
- [x] Przygotowano odcięcie anon od `article_poll_open`.
- [ ] Przejść CI replay migracji na czystym lokalnym Supabase.
- [ ] Dodać/wykonać testy uprawnień anon/authenticated/service_role.
- [ ] Dopiero po pozytywnym PR i odrębnej decyzji wdrożyć migrację na produkcję.

### Etap 3 — zgodność Edge Functions
- [ ] Porównać pełny kod i zależności wszystkich 29 wdrożonych Edge Functions z GitHub.
- [ ] Priorytet: `tnb-payments`, `tnb-orders`, `tnb-admin`, `tnb-notifications`, `tnb-library-delivery`, `tnb-newsletter`, `tnb-contact`.
- [ ] Zweryfikować `verify_jwt` z modelem autoryzacji każdej funkcji.
- [ ] Dla webhooków sprawdzić podpisy, referencje, replay, idempotencję i retry.

### Etap 4 — frontend i panel administratora
- [ ] Mapowanie każdej starej trasy, komponentu i funkcji do nowego odpowiednika.
- [ ] Porównanie widoków i rzeczywistych operacji: odczyt, zapis, edycja, usuwanie, upload, publikacja.
- [ ] Testy ról: gość, użytkownik, moderator, admin, superadmin.
- [ ] Usunięcie pozostałości Start dopiero po potwierdzeniu braku użycia.

### Etap 5 — testy regresji
- [ ] Testy wszystkich kluczowych przepływów w izolowanym środowisku.
- [ ] Testy mobilne i desktopowe.
- [ ] Testy płatności wyłącznie w sandbox.
- [ ] Testy poczty wyłącznie na kontrolowanych adresach.
- [ ] Odtworzenie bazy od zera wyłącznie na odrębnym środowisku testowym.

### Etap 6 — gotowość do publikacji
- [ ] Audyt bezpieczeństwa, wydajności, SEO i hostingu.
- [ ] Weryfikacja wszystkich głębokich adresów SPA.
- [ ] Weryfikacja dostarczania poczty i double opt-in.
- [ ] Końcowy test produkcyjny bez otwierania platformy publicznie.
- [ ] Osobna decyzja właściciela o wyłączeniu trybu przedpremierowego.

## 7. Zasada zamknięcia

Nie uznajemy migracji za zakończoną, dopóki każdy element starej aplikacji ma przypisany status: przeniesiony i przetestowany, świadomie usunięty, albo jawnie odłożony z uzasadnieniem. CI PASS i udany deployment nie zastępują testów funkcjonalnych ani audytu uprawnień.


## Aktualizacja audytu i inwentaryzacji — 2026-11-22 21:xx CET

Poniższy stan został ponownie odczytany z GitHub po commicie bazowym opisanym wyżej. Jest to uzupełnienie wcześniejszego snapshotu, nie jego nadpisanie.

### Aktualny snapshot repozytorium

Porównanie pełnych drzew Git (liczone wyłącznie pliki typu blob):

| Wskaźnik | Kopia sprzed SPA | Aktualne main |
|---|---:|---:|
| Pliki w repozytorium | 500 | 718 |
| Pliki tras w `src/routes` | 72 | 60 |
| Pliki `.functions.ts` / `.server.ts` w `src` | 42 | 41 |
| Middleware TanStack Start | 2 | 2 |
| Usunięte pliki tras API | — | 13 |

Wynik: 72 dawne pliki tras obejmowały 13 endpointów API i pozostałe strony. Wszystkie dawne trasy stron mają odpowiednik w aktualnym repo; 13 tras API zostało usuniętych z routera Start i wymaga testów równoważności w nowych Edge Functions. Nie wolno utożsamiać tego z potwierdzonym testem E2E.

W repo pozostały dwa wygenerowane middleware TanStack Start: `auth-middleware.ts` i `auth-attacher.ts`. Skrypt `scripts/check-legacy-runtime-isolation.sh` jawnie wyłącza je z grafu aplikacji i CI sprawdza, że kod tras/komponentów nie importuje plików legacy. Nie są one obecnie importowane przez wejście Vite według kontrolowanego skryptu izolacji. Pakiet `@tanstack/react-start` pozostaje w `devDependencies`; nie usuwam go automatycznie, dopóki nie zostanie wykonana czysta instalacja i kontrola lockfile na środowisku z Bun.

### Ważne aktualizacje względem poprzedniego snapshotu

- Bieżący HEAD `main` podczas ponownego odczytu: `0c7e8c71359c7f964a100fed8f4f45160a68f6b0`.
- PR #21 „Zabezpiecz powiązanie referencji transakcji Tpay” został scalony. Dodaje fail-closed dla braku tytułu Tpay oraz testy czystej funkcji normalizującej referencję. To poprawka źródłowa; nie oznacza wdrożenia nowej Edge Function ani testu płatności sandbox.
- Ostatni potwierdzony build GitHub Actions w odczycie audytu dotyczy commita `0b9dc6d88929225b99e55271583611d29acc5357`. Dla nowszego HEAD `0c7e8c7` nie uzyskano jeszcze potwierdzonego zielonego przebiegu w tym audycie.
- CodeMindAI ma aktywną dwukierunkową synchronizację z `main`; ostatni odczyt wykazał zero oczekujących pushy i udany auto-pull. Ostatni deployment miał status completed, 190/190 plików, a cel został zweryfikowany.
- Tryb przedpremierowy pozostaje aktywny. Nie zmieniano ustawień publikacji w trakcie tej kontroli.

### Granice potwierdzenia

- 22 pliki Edge miały zgodne entrypointy `index.ts`, a 7 wykazywało rozbieżności live/repo w snapshotcie z 22.11. Zgodność entrypointu nie potwierdza zgodności importowanych helperów ani runtime.
- Pakiet `tnb-payments` ma dodatkową rozbieżność pliku `providers.ts`; nie wdrażać go bez sandboxowych testów P24/Tpay/PayU.
- Produkcyjna poczta pozostaje w trybie testowym; nie potwierdzono dostarczania realnych wiadomości.
- Brak potwierdzonego pełnego E2E dla wszystkich ról i wszystkich starych tras.

### Zaktualizowana kolejność wykonania

1. Zamknąć mapę wszystkich 13 dawnych tras API → Edge Function, wraz z metodami HTTP, auth, walidacją, CORS, limitami, kodami błędów i testem.
2. Zamknąć mapę 41 pozostałych plików legacy → adapter SPA / Edge / świadomie zachowany moduł izolowany. Dla każdego pliku zapisać: konsumentów, równoważność, test i decyzję.
3. Najpierw zakończyć testy płatności w sandboxie i projekt trwałego outbox/idempotencji. Nie wdrażać rozbieżnego pakietu płatności.
4. Następnie przeprowadzić E2E głównych funkcji użytkownika i panelu admina w izolowanym środowisku.
5. Dopiero po potwierdzeniu braku użycia usunąć pozostałości TanStack Start i odświeżyć lockfile w środowisku z Bun.
6. Utrzymać prelaunch aż do osobnej decyzji właściciela o publikacji.

### Zmiany wykonane w ramach tej aktualizacji

Wyłącznie aktualizacja dokumentacji audytu na gałęzi roboczej. Nie zmieniono kodu aplikacji, schematu bazy, danych, RLS, sekretów, funkcji Edge, płatności, poczty ani ustawień deploymentu.
