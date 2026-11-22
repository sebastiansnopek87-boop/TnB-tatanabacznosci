# TNB — oddzielenie listy przedpremierowej od newslettera

Data: 2026-11-22

## Ustalenie

Formularz przedpremierowy używał `subscribeNewsletter`, `NEWSLETTER_CONSENT_TEXT` i tabeli `newsletter_subscribers`. Tekst zgody obejmował newsletter, mimo że opis formularza obiecywał wyłącznie jednorazową informację o uruchomieniu TNB. To nie jest zgodne z zakładanym celem zbierania danych.

## Zmiana w PR

- Dedykowana tabela `prelaunch_signups`; dane listy przedpremierowej nie trafiają do newslettera.
- Osobna, wersjonowana zgoda na jednorazową informację o starcie.
- Zapis imienia, znormalizowanego e-maila, czasu zgody, wersji tekstu zgody, skrótu IP i user-agenta.
- Unikalny adres e-mail i jednorazowy token wycofania zgody; w bazie przechowywany jest wyłącznie SHA-256 tokenu, nie jego wartość jawna.
- Tabela ma RLS bez polityk; bezpośredni dostęp anon/authenticated jest odebrany. Dostęp ma wyłącznie service_role.
- Formularz ma osobną akcję Edge Function, honeypot i limit prób.
- Dodano stronę wycofania zgody.
- Dodano osobną pozycję panelu administratora i eksport CSV listy.
- Lista administratora nie udostępnia tokenów wycofania zgody.
- Wysyłka wiadomości nie jest aktywowana; status SMTP pozostaje testowy.

## Ochrona istniejących danych

Nie przeniesiono, nie zmieniono i nie usunięto żadnych rekordów z `newsletter_subscribers`. Istniejące zgody newsletterowe pozostają bez zmian. Nowe zapisy przedpremierowe trafiają wyłącznie do `prelaunch_signups`.

## Warunki przed wdrożeniem

- CI build, typecheck, lint i testy jednostkowe.
- Replay migracji na czystym, izolowanym Supabase.
- Weryfikacja nowej tabeli i RLS na produkcji po migracji.
- Kontrolowane wdrożenie zaktualizowanej `tnb-newsletter` Edge Function (verify_jwt pozostaje false; akcje admin sprawdzają token i rolę).
- Test zapisu, duplikatu, reaktywacji, wycofania zgody i odmowy dostępu bez roli admin.

## Pozostałe

Treść polityki prywatności jest zarządzana przez CMS. Wymaga sprawdzenia i uzupełnienia o przetwarzanie danych na liście przedpremierowej przed publicznym startem. Nie publikowano zmian w dokumencie prawnym.
