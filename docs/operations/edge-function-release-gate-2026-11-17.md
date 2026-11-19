# Bramka wdrożenia Edge Functions – 2026-11-17

## Stan źródeł krytycznych funkcji

Porównano treść entrypointów z gałęzi `chore/legacy-runtime-audit` z aktualnie wdrożonymi źródłami Supabase. W trzech sprawdzonych funkcjach entrypoint nie jest identyczny:

| Funkcja | Wdrożony entrypoint | Entry point w PR #11 | verify_jwt live |
|---|---:|---:|---:|
| `tnb-orders` | 31 866 znaków | 34 185 znaków | false |
| `tnb-payments` | 22 109 znaków | 23 396 znaków | false |
| `tnb-admin` | 37 012 znaków | 39 086 znaków | true |

Różnice zaczynają się już w importach. PR #11 dodaje m.in. współdzielony moduł SMTP do obsługi zamówień i administracji oraz walidację referencji operatora płatności w `tnb-payments`.

## Wnioski bezpieczeństwa

- W PR #11 pojawia się jawne sprawdzanie, czy referencja otrzymana od operatora jest identyczna z referencją zapisaną przy rozpoczęciu płatności. Sam identyfikator lokalnego zamówienia nie zastępuje tego sprawdzenia.
- Wspólny moduł płatności zawiera funkcje weryfikacji podpisów P24, Tpay i PayU oraz porównanie stałoczasowe dla podpisów.
- W PR #11 dodano wymóg pozytywnej odpowiedzi weryfikacji transakcji P24 przed potwierdzeniem webhooka.
- `verify_jwt=false` dla endpointów obsługujących webhooki nie może być zmieniane automatycznie. Wymagane jest potwierdzenie weryfikacji podpisu operatora i/lub innego mechanizmu autoryzacji w każdej ścieżce webhooka.
- Moduł SMTP odrzuca porty 25 i 587, wymaga zgodności adresu nadawcy z konfiguracją oraz wymusza TLS co najmniej 1.2.

## Bramka wdrożeniowa

Nie wdrażać tych funkcji pojedynczo i nie synchronizować automatycznie całego zestawu 29 funkcji. Wdrożenie musi nastąpić jako kontrolowany zestaw zależnych plików, po sprawdzeniu:

1. wszystkich plików zależnych importowanych przez każdą funkcję;
2. zachowania webhooków dla poprawnych, błędnych, powtórzonych i opóźnionych powiadomień;
3. idempotencji aktualizacji zamówienia i płatności;
4. braku ujawniania sekretów w odpowiedziach i logach;
5. konfiguracji SMTP i ścieżki awaryjnej, gdy poczta jest niedostępna;
6. ustawień `verify_jwt` zgodnych z rzeczywistym modelem autoryzacji danej funkcji.

**Decyzja:** to jest wykryta rozbieżność produkcja–repo, a nie zgoda na wdrożenie. Nie wykonano żadnego deploymentu Edge Function ani zmian sekretów. Przed wdrożeniem potrzebne są testy regresyjne na środowisku nieprodukcyjnym i akceptacja całego zestawu zależności.
