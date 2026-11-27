# Uzgodnienie historii migracji Supabase z repozytorium

Data odczytu: 2026-11-16  
Projekt: `pmdfiipontreuclfumdh`  
Branch: `chore/legacy-runtime-audit`  
Tryb: read-only. Nie zastosowano migracji i nie zmieniano bazy.

## Aktualizacja produkcyjna — 2026-11-27

Odczyt wykonany bez zmian w bazie i bez deployu:

- Aktywny projekt Supabase: `pmdfiipontreuclfumdh`, status `ACTIVE_HEALTHY`.
- Historia Supabase: 69 migracji; repozytorium `main`: 70 plików SQL.
- Jedynym plikiem repo, którego wersji nie ma w historii Supabase, jest `20261125190000_checkout_idempotency.sql`. Nie znaleziono migracji zapisanej w bazie bez odpowiadającego pliku w repo.
- Migracja przeszła odtworzenie na pustym, izolowanym Supabase w CI dla PR #38 (25.11.2026). Nie oznacza to, że została zastosowana w produkcji.
- Produkcyjne `public.library_orders` nie ma kolumn `checkout_idempotency_key`, `checkout_request_fingerprint`, `checkout_state`; nie ma też tabeli `public.library_checkout_sessions`.
- Produkcyjna Edge Function `tnb-orders` jest aktywna w wersji 1, zaktualizowana 2026-11-15 20:42:29 UTC. Jej `index.ts` różni się od `main` i nie zawiera obsługi klucza idempotencji. Pozostałe cztery pliki funkcji (`providers.ts`, `registry.ts`, `render.ts`, `deno.json`) są identyczne z repo.
- Kod `main` i formularz SPA przekazują już `idempotencyKey`; wdrożona funkcja z 15.11 go nie obsługuje. Nie wolno więc zakładać, że ochrona przed powtórzonym checkoutem działa na produkcji.

### Kolejność wdrożenia idempotencji checkoutu

1. Wykonać i zweryfikować kopię bezpieczeństwa produkcyjnej bazy.
2. Uzgodnić sposób zastosowania dokładnie tej migracji z historią Supabase; nie oznaczać jej jako wykonanej ręcznie i nie tworzyć pustych migracji zastępczych.
3. Zastosować `20261125190000_checkout_idempotency.sql` jeden raz i odczytowo potwierdzić kolumny, indeks unikalny, tabelę sesji oraz brak dostępu `anon`/`authenticated` do tabeli sesji.
4. Wdrożyć `tnb-orders` z bieżącego `main`, zachowując dotychczasowe `verify_jwt=false` i wewnętrzne kontrole uprawnień. Porównać wdrożone pliki z repo po deployu.
5. Dopiero potem opublikować statyczny `dist` na CyberFolks. Przed płatnościami live wykonać testy operatorów w sandbox: pojedyncze żądanie, podwójne kliknięcie, odświeżenie karty i powrót z operatora. Każdy wariant ma zachować jeden rekord zamówienia i jedną transakcję operatora.
6. Włączyć płatności live dopiero po potwierdzeniu wyników testów i konfiguracji operatorów.

Do czasu wykonania tych kroków nie wdrażać nowego `tnb-orders` ani nowego frontendu na produkcję. Nie wykonywano tu migracji, deployu Edge Function ani publikacji CyberFolks. Dostęp sieciowy do domeny hostingu nie był możliwy w tej sesji, więc stan publicznej witryny nie został potwierdzony.

## Wynik

Supabase zwraca **66 zapisanych migracji**. W drzewie repozytorium na tym branchu znajduje się tylko jeden plik migracji:

- `supabase/migrations/20261116100000_tnb_cron_jobs.sql`

W historii Supabase odpowiadający mu wpis ma wersję `20261116142112` i nazwę `tnb_cron_jobs`. Nazwa pliku w repo ma więc inny timestamp niż zapis w historii bazy. Pozostałych 65 plików źródłowych nie ma w aktualnym drzewie repo.

To nie jest drobna kosmetyczna różnica. Z samej tabeli historii można odzyskać wersje i nazwy migracji, ale nie ich treść SQL. Nie można odtworzyć pełnego schematu ani bezpiecznie odtworzyć bazy z samej listy nazw.

## Zarejestrowane migracje Supabase

| Wersja | Nazwa |
|---|---|
| `20261115140941` | `0000_contact_messages` |
| `20261115140957` | `0001_newsletter_and_email_settings` |
| `20261115141001` | `0002_admin_roles_and_policies` |
| `20261115141005` | `0003_community` |
| `20261115141010` | `0004_community_trigger_fix` |
| `20261115141015` | `0005_community_trigger_fix2` |
| `20261115141019` | `0006_community_post_visibility` |
| `20261115141023` | `0007_community_anon_column_lockdown` |
| `20261115141027` | `0008_community_feed_sectors_reports` |
| `20261115141031` | `0009_community_post_stats` |
| `20261115141100` | `0010_community_sectors_search` |
| `20261115141103` | `0011_app_role_premium` |
| `20261115141108` | `0012_library` |
| `20261115141112` | `0013_library_premium_orders` |
| `20261115141116` | `0014_library_order_payments` |
| `20261115141122` | `0015_orders_bank_transfer` |
| `20261115141126` | `0016_meetings_module` |
| `20261115141130` | `0017_meetings_touch_fix` |
| `20261115141143` | `0018_podcast_module` |
| `20261115141148` | `0019_consult_bookings` |
| `20261115141152` | `0020_consult_revoke_writes` |
| `20261115141156` | `0021_site_pages_cms` |
| `20261115141200` | `0022_admin_events` |
| `20261115141204` | `0023_app_role_granular` |
| `20261115141209` | `0024_platform_settings` |
| `20261115141212` | `0025_admin_media_index` |
| `20261115141227` | `0026_notification_engine` |
| `20261115141232` | `0027_notification_log_statuses` |
| `20261115141236` | `0028_payments_operators` |
| `20261115141241` | `0029_tnb_identity` |
| `20261115141245` | `0030_orders_is_test` |
| `20261115141248` | `0031_articles` |
| `20261115141255` | `0032_article_interactions` |
| `20261115141300` | `0033_poll_vote_withdraw` |
| `20261115141316` | `0034_migration` |
| `20261115141319` | `0035_library_pdf_watermark_and_free_delivery` |
| `20261115141323` | `0036_editorial_ai_assistant` |
| `20261115141327` | `0037_ai_editor_touch_fix` |
| `20261115141331` | `0038_library_item_descriptions` |
| `20261115141336` | `0039_podcast_subtitle_script` |
| `20261115141341` | `0040_meetings_webinar_live` |
| `20261115141345` | `0041_site_pages_builder_drafts` |
| `20261115141401` | `0042_builder_templates` |
| `20261115141405` | `0043_glos_tnb` |
| `20261115141410` | `0044_glos_tnb_youtube_sync` |
| `20261115141414` | `0045_youtube_api_key_store` |
| `20261115141418` | `0046_podcast_layout` |
| `20261115141422` | `0047_ai_materials` |
| `20261115141427` | `0048_ai_articles_newsletter` |
| `20261115141431` | `0049_articles_trash` |
| `20261115141444` | `0050_glos_tnb_instagram` |
| `20261115141448` | `0051_glos_tnb_unified_media` |
| `20261115141452` | `0052_glos_tnb_external_materials` |
| `20261115141457` | `0053_platform_module_visibility` |
| `20261115141500` | `0054_brand_settings` |
| `20261115141505` | `0055_brand_slogan_validation` |
| `20261115141509` | `0056_platform_visual_effects` |
| `20261115141514` | `0057_user_avatars` |
| `20261115141519` | `0058_platform_settings_company_contact_footer` |
| `20261115144703` | `0059_storage_private_buckets` |
| `20261115145217` | `0060_security_definer_execution_hardening` |
| `20261115150058` | `0061_admin_set_user_role_atomic` |
| `20261115153232` | `revoke_client_access_from_server_only_tables` |
| `20261115183518` | `0063_restrict_public_platform_settings_columns` |
| `20261115195727` | `0064_community_post_visible_authenticated` |
| `20261116142112` | `tnb_cron_jobs` |

## Co potwierdzono w kodzie React SPA

- Aplikacja startuje przez `index.html` → `src/main.tsx` → `src/router.tsx` i `RouterProvider`.
- Vite używa `@vitejs/plugin-react` i TanStack Router plugin. Nie ładuje TanStack Start jako runtime.
- CI buduje statyczny `dist`, wykonuje smoke test fallbacku tras i skanuje build pod kątem kodu serwerowego/sekretów.
- Repo zawiera 330 plików źródłowych pod `src/`; 41 plików `*.functions.ts` / `*.server.ts` oraz 2 pliki middleware nadal importujące `@tanstack/react-start` pozostają w inwentarzu migracyjnym.
- `@tanstack/react-start` jest nadal w `devDependencies`. Nie wolno usuwać tej zależności, dopóki wskazane pliki i ich typy nie zostaną bezpiecznie usunięte lub zastąpione.
- Kontrola granicy SPA potwierdza, że UI nie importuje handlerów serwerowych, ale to nie oznacza, że wszystkie moduły legacy zostały usunięte.

## Bezpieczny plan naprawy rozbieżności

1. Zachować kopię/snapshot schematu aktywnej bazy i listę wszystkich migracji; obecny raport zapisuje listę wersji, ale nie zastępuje snapshotu.
2. Odtworzyć oryginalne pliki migracji z wiarygodnego źródła (repozytorium/backup/artefakty wdrożeniowe), weryfikując zawartość względem aktualnego schematu i historii.
3. Nie generować sztucznych pustych migracji o starych numerach i nie uruchamiać ich na produkcji. Takie pliki nie odtworzą logiki DDL, RLS, triggerów ani funkcji.
4. Uzgodnić timestamp pliku `tnb_cron_jobs` z wersją zarejestrowaną w Supabase. Nie zmieniać historii migracji produkcyjnej bez planu i kopii.
5. Dopiero po odtworzeniu historii utworzyć nową migrację idempotencji zamówień/outbox, najpierw uruchomić ją na odizolowanym środowisku testowym, wykonać testy i porównać schemat.
6. Wprowadzić kontrolę CI, która wykrywa rozjazd: migracja obecna w historii środowiska musi mieć odpowiadający plik źródłowy w repo, a nazwa pliku musi mieć ten sam timestamp i nazwę.

## Warunek zamknięcia

- 66/66 migracji ma źródłowy plik SQL w repo lub formalnie zatwierdzony baseline z pełnym snapshotem.
- Wersja i nazwa migracji cron są zgodne z historią.
- Czysta baza testowa daje się odtworzyć z repo i przechodzi testy Edge Functions oraz aplikacji.
- Produkcyjna baza nie jest resetowana ani modyfikowana w ramach samego uzgadniania.


## Kontrola historii Git

Dodatkowo sprawdzono historię GitHub dla ścieżki `supabase/migrations`. Zwróciła jeden commit dodający plik `20261116100000_tnb_cron_jobs.sql`; zapytanie o ścieżkę `0000_contact_messages.sql` nie zwróciło żadnego commitu. W aktualnej historii tego repo nie ma więc poprzednich plików źródłowych, które można po prostu przywrócić przez checkout starszego commitu.

Wniosek: nie odtworzę brakujących 65 migracji z samej historii Git tego repo. Trzeba odzyskać je z oryginalnego projektu/backupów lub przygotować i zatwierdzić pełny baseline schematu. Nie będę generować atrap migracji ani oznaczać wersji jako wykonanych bez ich rzeczywistej treści.
