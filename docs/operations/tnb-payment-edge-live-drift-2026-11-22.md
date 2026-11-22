# TNB — dodatkowa kontrola pakietu płatności live

Data: 2026-11-22  
Projekt Supabase: `pmdfiipontreuclfumdh`

## Wykryta rozbieżność pliku pomocniczego

Porównanie całego pakietu wdrożonego `tnb-payments` wykazało dodatkową różnicę poza entrypointem:

- live `tnb-payments/providers.ts`: 13 879 znaków;
- GitHub `supabase/functions/tnb-payments/providers.ts`: 12 455 znaków;
- live `tnb-payments/providers.ts` jest bajtowo identyczny z aktualnym `supabase/functions/tnb-orders/providers.ts`.

To oznacza, że pakiet live `tnb-payments` korzysta z adapterów dostawcy odpowiadających modułowi `tnb-orders`, a nie z wyspecjalizowanego pliku `tnb-payments/providers.ts` z repozytorium. Nie można uznać całego pakietu live za zgodny z `main` na podstawie samego entrypointu.

## Zachowanie P24

W live `providers.ts` po odpowiedzi z `transaction/verify` brak pozytywnego wyniku jest mapowany na wynik `pending`. W GitHub nowy kod wymaga `p24VerificationSucceeded`; przy nieudanej weryfikacji adapter odrzuca powiadomienie i pozwala operatorowi ponowić callback. Obie ścieżki wymagają testu z prawdziwymi przykładowymi payloadami sandbox i kontrolą ACK/HTTP.

Oficjalna dokumentacja P24 mówi, że transakcja jest potwierdzona dopiero po pomyślnej weryfikacji `transaction/verify`, a `sessionId` jest identyfikatorem z systemu sprzedawcy, natomiast `orderId` numerycznym identyfikatorem P24. Zob. <https://developers.przelewy24.pl/>.

## Tpay — referencja transakcji

Oficjalna dokumentacja Tpay opisuje `tr_id` jako tytuł transakcji przypisany przez Tpay i zwracany przy tworzeniu transakcji. Powiadomienie zawiera ten sam identyfikator. Repozytoryjny kod powinien zatem przechowywać tytuł transakcji i porównywać go z `tr_id`, bez fallbacku do lokalnego UUID lub innego identyfikatora. Zob. <https://docs.tpay.com/>.

W osobnym PR #21 dodano fail-closed dla brakującego `title` oraz testy czystej funkcji normalizującej referencję. PR nie został jeszcze scalony ani wdrożony.

## Decyzja wdrożeniowa

- Nie wdrażać obecnie `tnb-payments`.
- Najpierw przejrzeć pełny pakiet `index.ts`, `providers.ts`, `signatures.ts`, `registry.ts`, `render.ts`, `deno.json` i zależności `_shared`.
- Wykonać testy kontraktowe P24/Tpay/PayU: poprawny podpis, zły podpis, niezgodna referencja, niezgodna kwota/waluta, duplikat, retry, błędna weryfikacja P24.
- Uruchomić sandbox operatorów z kontrolowanymi zamówieniami.
- Dopiero po PASS i akceptacji osobnego release gate wdrożyć nową wersję Edge Function.

Żadna Edge Function ani sekret nie zostały zmienione w tej kontroli.
