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
