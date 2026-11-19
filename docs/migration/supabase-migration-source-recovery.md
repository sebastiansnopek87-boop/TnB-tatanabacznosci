# Odtworzenie źródeł migracji Supabase

Data odczytu: 2026-11-17  
Projekt: `pmdfiipontreuclfumdh`  
Branch odzyskiwania: `chore/restore-supabase-migrations-20261117`  
Commit odzyskania: `23640f48ccd0d749d4d28e67ffbdc33b96c539c8`

## Co zostało zrobione

- Odtworzono 65 plików SQL z katalogu `drizzle/migrations/` istniejącego w commicie źródłowym `ba47d2f1c3fc87d415f238e230f8f69ce43fab0c`.
- Każdy plik został umieszczony w `supabase/migrations/` pod wersją i nazwą odpowiadającą wpisowi w historii migracji aktywnego projektu.
- Plik cron jobs przeniesiono z nazwy `20261116100000_tnb_cron_jobs.sql` pod wersję z historii Supabase: `20261116142112_tnb_cron_jobs.sql`. Treść SQL nie została zmieniona.
- Łącznie repozytorium zawiera teraz źródła dla 66 wpisów historii migracji.

## Historia odczytana z Supabase

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

## Ograniczenia i bezpieczeństwo

To jest odzyskanie plików źródłowych z historii Git oraz przypisanie ich do wersji zapisanych w Supabase. Nie jest to dowód kryptograficzny, że każda historyczna treść SQL jest identyczna z SQL wykonanym w przeszłości na produkcyjnej bazie — Supabase nie udostępnia tu oryginalnych treści zastosowanych migracji. Przed użyciem odtworzonych plików do budowania nowej bazy należy wykonać niezależny audyt SQL i porównać wynikowy schemat z aktywną bazą.

**Nie zastosowano żadnej migracji do produkcyjnego Supabase.** Nie wykonano DDL, nie zmieniano danych, polityk RLS, sekretów ani funkcji Edge. Zmiany dotyczą wyłącznie plików w GitHub na osobnej gałęzi.

## Warunek dalszego użycia

- Zweryfikować wszystkie 66 ścieżek i zgodność nazw z `supabase_migrations.schema_migrations`.
- Wykonać kontrolę składni i statyczny przegląd SQL, zwłaszcza polityk RLS, funkcji `SECURITY DEFINER`, triggerów i grantów.
- Uruchomić CI.
- Nie wykonywać `supabase db push` na produkcji w ramach tego zadania.
