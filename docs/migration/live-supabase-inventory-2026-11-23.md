# Inwentaryzacja aktywnego Supabase przed migracją danych

Data odczytu: 2026-11-23  
Tryb: read-only. Nie wykonano zapisów, migracji, zmian sekretów ani wdrożeń.

## Aktywny projekt źródłowy

- Region: `eu-west-3` (Paryż).
- PostgreSQL: 17.11.
- Status: `ACTIVE_HEALTHY`.
- Konfiguracja repozytorium `supabase/config.toml` wskazuje ten projekt jako obecne źródło.
- Nowy, niezależny projekt docelowy nie został utworzony.

## Historia migracji — zgodność potwierdzona

Porównano drzewo `main` z wynikiem `supabase_migrations.schema_migrations`:
- pliki SQL w repo: 69;
- wpisy w aktywnej bazie: 69;
- brakujące wersje: 0;
- wersje z niezgodną nazwą: 0;
- wpisy bazy bez pliku w repo: 0.

To aktualizuje historyczny raport z 16 listopada, który opisywał wcześniejszy stan repozytorium. Obecny łańcuch migracji jest kompletny względem aktywnej bazy.

## Stan danych — agregaty

Odczytane liczby rekordów:
- konta Auth: 1;
- subskrybenci newslettera: 1;
- wpisy dziennika administratora: 67;
- przypisania ról: 2;
- kategorie biblioteki: 8;
- ustawienia platformy: 1;
- ustawienia e-mail: 1;
- ustawienia konsultacji: 1;
- konfiguracje operatorów płatności: 3;
- ustawienia asystenta AI: 1;
- źródło YouTube: 1;
- źródło Instagram: 1;
- rekord sekretów Instagram: 1.

W chwili odczytu tabele z treściami użytkowników i zakupami miały zero rekordów: materiały biblioteki, zamówienia, artykuły, posty społeczności, odcinki podcastu, spotkania i strony CMS. To nie jest zgoda na pominięcie tych tabel przy migracji — należy zachować pełny schemat, RLS, funkcje, sekwencje, triggery i ustawienia.

## Storage

W bazie istnieje 6 prywatnych bucketów:
- `article-images` — 0 obiektów;
- `library-files` — 0;
- `media` — 4;
- `meeting-images` — 0;
- `page-images` — 0;
- `podcast-files` — 0.

Cztery obiekty z `media` wymagają kopiowania i porównania metadanych/sum kontrolnych. Nie wystarczy przenieść rekordy bazy.

## Porównanie wybranych wdrożonych Edge Functions z repo

Porównano treść entrypointu `index.ts` aktywnej funkcji z plikiem `main`:
| Funkcja | Wersja aktywna | Entry point identyczny z repo |
|---|---:|---|
| `tnb-orders` | 1 | Nie |
| `tnb-payments` | 1 | Nie |
| `tnb-consult` | 5 | Nie |
| `tnb-platform` | 5 | Tak |
| `tnb-admin` | 3 | Tak |
| `tnb-newsletter` | 2 | Tak |

Wniosek: kod źródłowy i aktywne wdrożenia nie są w pełni zgodne. Szczególnie funkcje zamówień, płatności i konsultacji wymagają osobnego diffu wszystkich plików zależnych, testów na stagingu i kontrolowanego rollout. CI repozytorium nie dowodzi, że kod z repo działa już w aktywnym Supabase.

## Wnioski dla migracji danych

1. Nie trzeba rekonstruować historii 69 migracji — została uzgodniona 1:1.
2. Przed migracją należy wykonać backup bazy i Storage, a następnie próbę odtworzenia na nowym projekcie.
3. Przenieść rekordy wszystkich tabel, także ustawienia i role; zachować UUID, relacje, tokeny, timestampy i wartości sekwencji.
4. Skopiować wszystkie obiekty Storage z zachowaniem bucketów, ścieżek, MIME type, metadanych i prywatności.
5. Przenieść konfigurację Auth, redirect URLs, SMTP, Edge Function secrets, cron/Vault, CORS i webhook URLs osobno; sekretów nie przenosić do repo ani do klienta.
6. Wygenerować typy z docelowego schematu i porównać je z repo.
7. Po kopii wykonać porównanie liczby rekordów i sum kontrolnych tabel/plików.
8. Przełączenie aplikacji na nowy Supabase dopiero po testach staging, w tym logowania, ról, uploadów, newslettera, zakupów, webhooków i powiadomień.

## Blokady

- Nie utworzono docelowego Supabase, ponieważ wybór organizacji i regionu oraz akceptacja ewentualnego kosztu muszą być potwierdzone przed utworzeniem projektu.
- Nie wykonano migracji danych ani przełączenia `SUPABASE_URL` / kluczy.
- Nie wdrożono funkcji Edge z repo na aktywny projekt.
- Nie przełączono hostingu ani DNS.
- Tryb przedpremierowy pozostaje bez zmian.
