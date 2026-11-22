# TNB — porównanie tras i Edge Functions z produkcją

Data: 2026-11-22  
Repozytorium: `sebastiansnopek87-boop/TnB-tatanabacznosci`  
Supabase: `pmdfiipontreuclfumdh`

## 1. Trasy aplikacji

Porównanie drzewa `src/routes` kopii `backup/pre-spa-migration-2026-11-15` z aktualnym `main`:

- 72 pliki tras w kopii;
- 60 plików tras obecnie;
- wszystkie dawne trasy stron (bez `src/routes/api/**`) mają odpowiednik w aktualnym repo;
- dodano `src/routes/newsletter.potwierdz.tsx`;
- usunięto 13 tras API TanStack Start; aktualnie nie ma `src/routes/api/**`.

Usunięte trasy API i docelowy obszar do potwierdzenia kontraktu:

| Dawna trasa | Docelowa funkcja/obszar | Stan |
|---|---|---|
| `article-image.$id.$name` | `tnb-assets` / obrazy artykułów | wskazanie z dokumentacji; test URL i autoryzacji wymagany |
| `avatar.$kind.$id` | `tnb-avatar` | wskazanie z dokumentacji; test public/private wymagany |
| `brand.$file` | `tnb-brand` | wskazanie z dokumentacji; test zakresu plików wymagany |
| `cron/consult-reminders` | harmonogram Supabase + `tnb-consult` | aktywne zadanie cron; pełny test powiadomień wymagany |
| `cron/instagram-sync` | harmonogram Supabase + `tnb-media` | aktywne zadanie cron; pełny test OAuth/synchronizacji wymagany |
| `instagram/callback` | `tnb-media` / OAuth | nie uznajemy za równoważne bez testu callback i refresh token |
| `library-cover.$id` | `tnb-assets` | wskazanie z dokumentacji; test dostępu do pliku wymagany |
| `meeting-image.$id` | `tnb-assets` | wskazanie z dokumentacji; test dostępu do pliku wymagany |
| `page-image.$id.$name` | `tnb-pages` | wskazanie z dokumentacji; test URL i wersji wymagany |
| `payments/p24` | `tnb-payments` | webhook; pełne testy podpisu, referencji, replay i kwoty wymagane |
| `payments/payu` | `tnb-payments` | webhook; pełne testy podpisu, referencji, replay i kwoty wymagane |
| `payments/tpay` | `tnb-payments` | webhook; pełne testy podpisu, referencji, replay i kwoty wymagane |
| `podcast-cover.$id` | `tnb-assets` | wskazanie z dokumentacji; test dostępu do pliku wymagany |

To jest mapa migracyjna, nie potwierdzenie zgodności endpointów. Zgodność trzeba wykazać porównaniem starej implementacji, nowej funkcji, helperów, nagłówków, statusów HTTP i zachowania błędów.

## 2. Izolacja pozostałości TanStack Start

- 40 plików `.functions.ts` / `.server.ts` pozostało w `src`.
- Dwa pliki middleware nadal importują `@tanstack/react-start`, ale są jawnie wymienione jako izolowane w `scripts/check-legacy-runtime-isolation.sh`.
- CI potwierdza, że komponenty i trasy SPA nie importują tych plików; pozostałości są poza grafem wejściowym Vite.
- `@tanstack/react-start` pozostaje w `devDependencies`; skrypt SPA boundary nie blokuje tej konkretnej zależności w devDependencies. Usunięcie jej wymaga aktualizacji lockfile i ponownego CI.
- Nie usuwać 40 plików przed porównaniem każdego kontraktu i testem regresji. Pliki legacy są obecnie materiałem porównawczym.

## 3. Porównanie 29 aktywnych Edge Functions

Wszystkie 29 funkcji Supabase były ACTIVE. Porównano zawartość wdrożonego `index.ts` z plikiem `supabase/functions/<slug>/index.ts` na `main`.

### Zgodne entrypointy — 22

`tnb-platform`, `tnb-articles`, `tnb-meetings`, `tnb-podcast`, `tnb-media`, `tnb-media-admin`, `tnb-avatar`, `tnb-youtube`, `tnb-voice`, `tnb-editor-ai`, `tnb-editor-materials`, `tnb-guest-comments`, `tnb-recommend`, `tnb-library-admin`, `tnb-brand`, `tnb-pages`, `tnb-templates`, `tnb-assets`, `tnb-health`, `tnb-users`, `tnb-admin`, `tnb-newsletter`.

Zgodność dotyczy entrypointu `index.ts`; nie zastępuje pełnej kontroli wszystkich zależności i zachowania runtime.

### Rozbieżne entrypointy — 7

| Funkcja | Wersja live | Live / repo znaków | Ustalona różnica | Decyzja |
|---|---:|---:|---|---|
| `tnb-payments` | 1 | 22 109 / 23 396 | repo dodaje kontrolę `providerReferenceMatches`; live jej nie ma | P1, nie wdrażać bez testów P24/Tpay/PayU |
| `tnb-orders` | 1 | 31 866 / 34 185 | repo dodaje transport SMTP; brak idempotencji zamówień nadal udokumentowany | nie wdrażać przed idempotencją i testem operatorów |
| `tnb-notifications` | 1 | 19 510 / 22 128 | repo dodaje transport SMTP | test dostarczenia i konfiguracji wymagany |
| `tnb-library-delivery` | 1 | 16 692 / 17 848 | repo dodaje transport SMTP | test tokenów, plików i SMTP wymagany |
| `tnb-contact` | 7 | 12 257 / 13 294 | repo dodaje transport SMTP | test antyspamu, CORS i SMTP wymagany |
| `tnb-consult` | 5 | 29 728 / 31 022 | repo dodaje transport SMTP | test rezerwacji i powiadomień wymagany |
| `tnb-article-newsletter` | 1 | 22 674 / 24 420 | repo dodaje transport SMTP | test listy odbiorców, idempotencji i SMTP wymagany |

W `tnb-payments` live handler znajduje zamówienie po UUID zamówienia, ale nie porównuje niezależnie `notice.providerRef` z `library_orders.provider_ref`. Repozytorium dodaje takie porównanie przez `providerReferenceMatches`. To ważne zabezpieczenie przed potwierdzeniem niepowiązanej transakcji. Nie wdrażać funkcji płatności przed testami referencji każdego operatora.

W pozostałych sześciu rozbieżnych funkcjach różnica entrypointu dotyczy dodania SMTP. Produkcyjne `email_settings.delivery_mode` nadal jest `test`, a sekretów SMTP nie skonfigurowano w ramach tego audytu. Nie wolno uznać poczty za działającą ani przełączać na live.

### Ustawienia JWT

W live jest 7 funkcji z `verify_jwt=true` i 22 z `verify_jwt=false`. Wszystkie 29 mają jawne sekcje w `supabase/config.toml`. `verify_jwt=false` jest wymagane dla części publicznych endpointów i webhooków; handler musi sam wymuszać właściwą autoryzację, podpis operatora, CORS, limity i walidację. Nie zmieniać globalnie ustawień JWT.

## 4. Kolejność dalszych prac

1. Dokończyć porównanie wszystkich zależności funkcji rozbieżnych (nie tylko `index.ts`).
2. Naprawić i przetestować referencję webhooka płatności na sandboxie dla P24, Tpay i PayU.
3. Zaprojektować idempotencję tworzenia zamówienia oraz trwały outbox; nie tworzyć migracji bez testu czystego replay i uzgodnionego schematu.
4. Zweryfikować dostawę SMTP w trybie testowym na kontrolowanych adresach; dopiero potem rozważyć wdrożenie sześciu funkcji z transportem.
5. Przeprowadzić E2E dawnych tras API przez nowe funkcje.
6. Usunąć legacy dopiero po pełnym porównaniu i testach.
7. Utrzymać prelaunch do końcowej decyzji o publikacji.

## 5. Brak zmian produkcyjnych w tym audycie źródeł

Porównanie 29 entrypointów było odczytowe. Nie wdrożono żadnej Edge Function, nie zmieniono sekretów ani konfiguracji operatorów, SMTP, OAuth czy harmonogramów.


## Aktualizacja szczegółowego porównania tras API — 2026-11-22

Przeprowadzono dodatkowe porównanie kodu 13 dawnych handlerów z aktualnymi handlerami Edge i adapterami SPA. Statusy poniżej oznaczają przegląd statyczny kodu, nie test produkcyjny E2E.

| Dawny endpoint | Nowy odpowiednik | Wynik przeglądu kodu | Co pozostaje |
|---|---|---|---|
| `article-image.$id.$name` | `tnb-assets?kind=article` | Reguły publikacji, daty i użycia obrazu są zachowane w nowym handlerze | E2E: 404 dla nieopublikowanego/nieużywanego pliku, poprawny MIME i CORS |
| `avatar.$kind.$id` | `tnb-assets?kind=avatar` | Zachowano scope own/post/comment, weryfikację Bearer, autora i admina, prywatność szkiców i bucket path | E2E dla gościa, właściciela, autora, admina, komentarza i szkicu |
| `brand.$file` | `tnb-brand` GET | Funkcja ma publiczny handler plików marki; nie wymaga osobnej trasy API | E2E: tylko pliki wskazane przez ustawienia marki, MIME i nieznany plik |
| `cron/consult-reminders` | `tnb-consult` action `processReminders` | Handler Edge ma osobną kontrolę sekretu cron | Sprawdzić aktywne zadanie, body/URL, sekret, retry i rzeczywistą wysyłkę kontrolowaną |
| `cron/instagram-sync` | `tnb-voice` action `cronInstagramSync` | Handler Edge ma osobną kontrolę sekretu cron i `syncIfStale` | Potwierdzić konfigurację zadania cron, sekret i wynik synchronizacji |
| `instagram/callback` | `tnb-voice` action `finishInstagramOAuth` + nowa trasa SPA pod starym URL | Stara trasa serwerowa została usunięta; PR #26 przywraca ten sam URL jako trasę SPA. Edge sprawdza jednorazowy, wygasający state | PR #26 Draft/CI; po merge i deploy frontendu wykonać Meta OAuth na koncie testowym |
| `library-cover.$id` | `tnb-assets?kind=library` | Zachowano warunek opublikowanego materiału i prywatny bucket | E2E: draft/archived 404, published 200 |
| `meeting-image.$id` | `tnb-assets?kind=meeting` | Zachowano ukrycie szkiców i prywatny bucket | E2E: draft 404, opublikowany/pozostały status zgodny ze starym zachowaniem |
| `page-image.$id.$name` | `tnb-pages?image=...` | Zachowano publikację strony, sprawdzenie czy obraz jest użyty i prywatny bucket | E2E: draft, nieużywany plik, błędna nazwa, poprawny obraz |
| `payments/p24` | `tnb-payments` webhook | Logika została przeniesiona do Edge; wykryto drift live i osobny brak pełnej zgodności pakietu providerów | P1: sandbox P24, podpis, order/reference, amount/currency, replay i ACK |
| `payments/payu` | `tnb-payments` webhook | Logika została przeniesiona do Edge; wykryto drift live i osobny brak pełnej zgodności pakietu providerów | P1: sandbox PayU, podpis surowego body, order/reference, amount/currency, replay i ACK |
| `payments/tpay` | `tnb-payments` webhook | Źródło ma poprawkę referencji Tpay z PR #21; pakiet live nadal różni się od repo | P1: sandbox Tpay, `tr_id` = zapisany tytuł transakcji, podpis, kwota/waluta, replay i ACK |

### Dodatkowe ustalenia

- Instagram nie jest obsługiwany przez `tnb-media`. Operacje Instagram (start OAuth, callback completion, sync, disconnect, settings i cron) znajdują się w `tnb-voice`. Poprzednia ogólna tabela wskazująca `tnb-media` dla OAuth była zbyt szeroka; powyższa tabela ją precyzuje.
- Nowy callback nie zmienia adresu w Meta. W PR #26 route SPA używa dotychczasowej ścieżki `/api/public/instagram/callback`, a Edge nadal generuje ten sam Redirect URI. To ogranicza zakres zmiany i nie wymaga deployu `tnb-voice`.
- PR #26 jest roboczy. Nie jest scalony ani wdrożony; do tego czasu nie deklarujemy, że OAuth jest naprawiony w produkcji.
- `tnb-assets` łączy publiczne obrazy artykułów, biblioteki, spotkań, podcastu i avatary. Brand image jest osobnym GET w `tnb-brand`; obrazy stron są obsługiwane przez GET w `tnb-pages`.
- Żaden z powyższych testów E2E nie został wykonany na rzeczywistych rekordach produkcyjnych w tej aktualizacji.

### Wniosek etapu 1

Statyczne mapowanie endpointów zostało uzupełnione. Etap 1 nie jest jeszcze zamknięty: nadal brakuje wykonania kontrolowanych testów endpointów na izolowanym środowisku oraz pełnej mapy wszystkich pozostałych plików legacy. Nie zmieniono produkcyjnych Edge Functions, sekretów, płatności, danych ani ustawień poczty.
