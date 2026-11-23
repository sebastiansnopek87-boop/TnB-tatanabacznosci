# React SPA — punkt odniesienia zgodności funkcjonalnej

Data audytu: 2026-11-23  
Źródło: branch `main`, commit `68d54e75ea64f9a5464de2155361dd005c6e544c`  
Cel: zachować dotychczasowy produkt TNB podczas migracji runtime do statycznego React SPA.

## Zasada nadrzędna

Migracja nie jest redesignem ani redukcją zakresu. Nowa aplikacja ma zachować dotychczasowe ekrany, nawigację, role, reguły dostępu, treści, pliki, ustawienia, integracje, dane i skutki uboczne. Żadna tabela ani zawartość nie może zostać wyczyszczona lub zastąpiona danymi demonstracyjnymi. Wątpliwe zachowanie należy najpierw odtworzyć i udokumentować, a dopiero potem zmieniać.

## Migawka repozytorium

| Element | Stan na main |
|---|---:|
| Pliki tras React | 61 |
| Adaptery API SPA w `src/lib/api` | 27 |
| Katalogi Supabase Edge Functions z entrypointem | 29 |
| Pliki SQL w `supabase/migrations` | 69 |
| Moduły legacy `*.functions.ts` / `*.server.ts` | 41 |
| Middleware Supabase importujące TanStack Start | 2 |
| Moduły legacy wymagające audytu | 43 |

SPA uruchamia się przez `index.html → src/main.tsx → src/router.tsx`. Produkcyjny build jest statycznym `dist`, a CI obejmuje m.in. build, TypeScript, testy, fallback tras, izolację legacy i skan buildu.

## Zakres funkcjonalny widoczny w trasach

- Strona główna, O TNB, Moja historia, strony CMS i prawne.
- Biblioteka, materiały premium, zakup, odzyskiwanie dostępu i dostarczanie plików.
- Społeczność, wpisy, komentarze, zgłoszenia i moderacja.
- Podcast, odcinki i audio.
- Spotkania, rezerwacje, webinary i konsultacje 1:1.
- Artykuły, newsletter, potwierdzanie i wypis.
- Kontakt, logowanie, reset hasła, profil i ustawienia konta.
- Panel administracyjny: artykuły, AI, bezpieczeństwo, biblioteka, centrum kontroli, dziennik, multimedia, płatności, podcast, powiadomienia, rozmowy, społeczność, spotkania, standardy, strony, subskrybenci, szablony, treści, ustawienia, użytkownicy, zamówienia i zdarzenia.

Ta lista pochodzi z aktualnego drzewa tras. Sama obecność trasy nie dowodzi, że każdy wariant zachowania jest równoważny staremu runtime.

## Mapa integracji

27 adapterów SPA komunikuje się z 29 katalogami Edge Functions. Każda akcja wymaga porównania:
1. starego kontraktu wejścia i wyjścia;
2. nowego adaptera SPA;
3. schematu walidacji Edge Function;
4. kontroli sesji i roli (anon, user, admin, superadmin);
5. RLS i dostępu do Storage;
6. skutków ubocznych (e-mail, webhook, cron, AI, upload, publikacja);
7. błędów, retry, limitów i idempotencji.

Nie wolno usuwać modułu legacy tylko dlatego, że istnieje funkcja o podobnej nazwie.

## Pozostałości runtime legacy

Na main nadal istnieje 41 plików `*.functions.ts` / `*.server.ts` oraz dwa middleware:
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/auth-middleware.ts`

W inwentarzu wymieniono je indywidualnie w `docs/migration/legacy-runtime-inventory.md`. Należy wykonać audyt zależności, importów testowych i odpowiedników Edge. Po przeniesieniu testów do niezależnych modułów i potwierdzeniu braku konsumentów pliki można usuwać partiami. Dopiero na końcu można usunąć `@tanstack/react-start` z manifestu i lockfile.

## Dane i historia Supabase

W aktualnym drzewie main znajdują się 69 plików migracji SQL. Starszy raport `docs/migration/supabase-migration-reconciliation.md` opisuje stan z 16 listopada 2026, w którym katalog zawierał tylko jeden plik. Ten fragment raportu jest historyczny i nie może być używany jako opis bieżącego drzewa.

Nadal wymagane:
- odczyt bieżącej historii `supabase_migrations.schema_migrations` na docelowym projekcie;
- porównanie 1:1 wersji i nazw z 69 plikami repo;
- odczyt schematu, RLS, triggerów, RPC, bucketów i ustawień Storage;
- uzgodnienie typów wygenerowanych z rzeczywistym schematem;
- backup i próba odtworzenia na osobnym projekcie;
- porównanie liczby i sum kontrolnych danych przed/po migracji.

Nie wykonano w tym audycie zapisów do Supabase, migracji danych, zmian sekretów ani wdrożeń Edge Functions.

## Bramy produkcyjne

Przed przeniesieniem ruchu:
- [ ] Zatwierdzona macierz zgodności wszystkich tras i funkcji.
- [ ] Testy wizualne porównujące te same widoki desktop/mobile ze starym produktem.
- [ ] E2E: gość, użytkownik, admin i superadmin.
- [ ] Testy formularzy, walidacji, błędów, nawigacji, deep links, odświeżania, back/forward i uploadów.
- [ ] Testy RLS, Storage, dostępu premium, webhooków, cronów, SMTP i integracji zewnętrznych.
- [ ] Wszystkie 43 moduły legacy usunięte albo formalnie uzasadnione jako nieużywany kod testowy; brak runtime importów Start.
- [ ] Czysty build i CI na finalnym SHA.
- [ ] Pełny backup i próbna migracja danych na odrębnym Supabase.
- [ ] Weryfikacja wszystkich rekordów, plików Storage, kont, ról, tokenów, treści CMS i ustawień.
- [ ] Własny Supabase i hosting zweryfikowane na stagingu.
- [ ] Test rollbacku i plan przełączenia DNS/hostingu.
- [ ] Testy produkcyjne po przełączeniu, bez włączania publicznego dostępu do czasu zgody właściciela.

## Ograniczenia i znane ryzyka

- PR #31 (idempotencja checkoutu) jest osobną, niezsynchronizowaną jeszcze z main gałęzią. CI build i replay migracji na pustej bazie przeszły dla jego SHA, ale PR pozostaje draft i nie jest wdrożony.
- System e-mail ma historycznie opisany tryb testowy; rzeczywiste dostarczenie wymaga weryfikacji konfiguracji SMTP i Supabase Auth.
- Kod Edge Functions w repo nie może być utożsamiany z kodem wdrożonym w produkcyjnym projekcie. Każda funkcja wymaga porównania SHA/treści, testu staging i kontrolowanego rollout.
- Produkcyjny projekt Supabase nie może być resetowany. Migracja danych musi być kopiowaniem i walidacją, a nie odtworzeniem pustej bazy.

## Definition of Done

Migrację uznajemy za zakończoną dopiero wtedy, gdy stara i nowa platforma przechodzą tę samą macierz scenariuszy, dane i pliki są zachowane, nie ma regresji wizualnych ani funkcjonalnych, własny Supabase i hosting działają na stagingu, rollback został przetestowany, a produkcyjny cutover jest potwierdzony testami. Sam udany build nie spełnia tego warunku.
