# TNB — kontrolowana procedura wdrożenia produkcyjnego

Ten dokument dotyczy wyłącznie projektu TNB i projektu Supabase `pmdfiipontreuclfumdh`.
Nie obejmuje Pure Life Center.

## Stan wyjściowy

- Automatyczne wdrażanie CodeMindAI: wstrzymane; nie wznawiać przed zakończeniem testów produkcyjnych.
- PR #16: `feat/delivery-outbox-worker` -> `main`; pozostaje otwarty i nie scalony.
- Migracje `20261118010000_checkout_idempotency.sql` i `20261119010000_library_delivery_outbox.sql` są przetestowane na izolowanej, pustej bazie; nie są jeszcze zastosowane na produkcji.
- Produkcyjne funkcje `tnb-orders` i `tnb-payments` są starszymi wersjami. Muszą zostać wdrożone jako zgodny zestaw.
- Płatności P24, PayU i Tpay są wyłączone. E-mail działa w trybie testowym.

## Warunki przed oknem wdrożeniowym

1. PR #16 ma zielone wymagane kontrole CI, aktualny head SHA i brak nierozwiązanych uwag.
2. Potwierdzono dostęp do kopii zapasowej bazy oraz możliwość jej odtworzenia. Sam fakt istnienia kopii nie wystarcza — sprawdzić datę, zakres i procedurę restore.
3. Przygotowano komplet plików Edge Functions:
   - `tnb-orders`: `index.ts`, `deno.json`, `providers.ts`, `registry.ts`, `render.ts`;
   - `tnb-payments`: `index.ts`, `deno.json`, `providers.ts`, `registry.ts`, `render.ts`;
   - wspólne zależności obu funkcji: `_shared/checkout-idempotency.ts`, `_shared/delivery-outbox.ts`, `_shared/cron-auth.ts`, `_shared/smtp.ts`, `_shared/payment-webhook.ts` (odpowiednio tylko te, które importuje dana funkcja).
4. Zweryfikowano, że zmienne środowiskowe wymagane przez nowe wersje są obecne, bez odczytywania ani ujawniania wartości sekretów.
5. Potwierdzono, że operatorzy płatności pozostają wyłączeni, a tryb e-mail pozostaje testowy do czasu osobnych testów integracyjnych.

## Kolejność wdrożenia

1. Wstrzymać automatyczne wdrażanie CodeMindAI i potwierdzić `paused=true`.
2. Ograniczyć zmiany w panelu zamówień na czas okna wdrożeniowego; nie przyjmować płatności online.
3. Wykonać świeżą kopię zapasową i odnotować punkt przywracania.
4. Zastosować obie migracje w kolejności:
   - `20261118010000_checkout_idempotency.sql`;
   - `20261119010000_library_delivery_outbox.sql`.
5. W krótkim, kontrolowanym oknie wdrożyć `tnb-orders` i `tnb-payments` z kompletem plików i właściwym ustawieniem `verify_jwt=false` (zgodnie z obecnymi webhookami i własną autoryzacją funkcji).
6. Sprawdzić, że harmonogram `tnb-library-delivery-outbox` istnieje, a wywołanie workera przechodzi autoryzację. Nie ujawniać tokenu cron.
7. Wykonać testy funkcjonalne na sandbox/test:
   - powtórzenie tego samego checkout intent nie tworzy drugiego zamówienia ani drugiej transakcji operatora;
   - różny fingerprint dla tego samego klucza jest odrzucany / kierowany do uzgodnienia;
   - webhook jest idempotentny;
   - przejście `paid_at: null -> wartość` tworzy dokładnie dwa zdarzenia outbox;
   - worker przetwarza zdarzenia, a ponowne wywołanie nie wysyła duplikatów;
   - niejednoznaczny wynik SMTP trafia do `needs_review`, bez automatycznej ponownej wysyłki;
   - awaria przed przekazaniem do SMTP może być ponawiana zgodnie z limitem.
8. Sprawdzić logi Supabase, statusy outbox, `email_notification_log` i status dostępu do materiału.
9. Dopiero po zatwierdzeniu backendu opublikować artefakt SPA i wykonać testy tras, logowania, biblioteki oraz panelu.
10. Płatności online i produkcyjny SMTP włączyć dopiero po osobnej konfiguracji i udanym teście end-to-end na sandboxie, a następnie kontrolowanym teście produkcyjnym.

## Kryteria zatrzymania / wycofania

Przerwać wdrożenie i nie publikować SPA, jeśli:
- migracja nie przejdzie w całości;
- funkcje nie startują lub nie mogą załadować wspólnych modułów;
- cron nie autoryzuje się;
- webhook potwierdza płatność bez prawidłowej referencji/operatora/kwoty;
- worker może wysłać duplikat lub automatycznie ponawia niejednoznaczny wynik SMTP;
- testy dostępu do zakupionego materiału nie przechodzą.

Wycofanie:
- Nie usuwać tabel outbox ani kolumn idempotency po uruchomieniu, jeśli istnieją już rekordy — mogłoby to zniszczyć ślad audytowy lub dane zamówień.
- W razie problemu najpierw wyłączyć/odroczyć cron job, a następnie przywrócić poprzednie wersje Edge Functions. Zachować nowe tabele i kolumny, o ile nie ma osobnej, przeanalizowanej migracji odwracającej.
- Przy uszkodzeniu danych użyć zweryfikowanej kopii zapasowej i procedury restore Supabase; nie wykonywać improwizowanego `DROP` ani ręcznego cofania DDL.
- Po wycofaniu sprawdzić webhooki, statusy zamówień, logi i dostęp do materiałów.

## Przywrócenie automatycznego wdrażania

CodeMindAI można wznowić dopiero po:
- zakończeniu wdrożenia i testów produkcyjnych;
- potwierdzeniu, że źródło wdrożenia wskazuje zatwierdzoną gałąź/commit;
- sprawdzeniu ścieżki docelowej i zawartości artefaktu;
- potwierdzeniu, że nie ma oczekujących, niezatwierdzonych zmian.

Wznowienie wymaga jawnej decyzji właściciela projektu. Nie włączać automatyzacji tylko dlatego, że zakończył się build CI.
