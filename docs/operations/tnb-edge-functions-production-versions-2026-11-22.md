# TNB — dodatkowa kontrola wersji Edge Functions

Data: 2026-11-22  
Projekt Supabase: `pmdfiipontreuclfumdh`

To uzupełnienie audytu rozbieżności płatności. Dane pobrano bezpośrednio z wdrożonych źródeł funkcji i porównano z plikami gałęzi `main`. Nie wykonywano wdrożeń ani zmian w bazie.

## Wersje produkcyjne odczytane z Supabase

| Funkcja | Wersja | Ostatnia aktualizacja UTC | Status |
|---|---:|---|---|
| `tnb-orders` | 1 | 2026-11-15 20:42:29 | ACTIVE |
| `tnb-payments` | 1 | 2026-11-15 20:39:23 | ACTIVE |
| `tnb-voice` | 4 | 2026-11-16 14:20:59 | ACTIVE |
| `tnb-pages` | 4 | 2026-11-15 19:59:13 | ACTIVE |
| `tnb-assets` | 4 | 2026-11-15 20:15:34 | ACTIVE |
| `tnb-avatar` | 2 | 2026-11-15 20:19:53 | ACTIVE |

Status ACTIVE oznacza, że funkcja jest aktywna, a nie że jej kod jest zgodny z `main`.

## Potwierdzone rozbieżności

### `tnb-orders`

- Produkcyjny `index.ts`: 31 866 znaków.
- `main` `index.ts`: 34 185 znaków.
- Podstawowa ścieżka tworzenia zamówienia i zapis referencji checkout występują w obu wersjach.
- Produkcyjny plik nie zawiera `sendSmtpMail`, który występuje w wersji repozytoryjnej.
- Produkcyjna funkcja ma wersję 1 i ostatnią aktualizację 15 listopada.
- Nie przeprowadzono pełnego diffu wszystkich plików i testów zachowania. Nie należy utożsamiać różnicy rozmiaru lub jednego markera z pełnym wykazem zmian.

### `tnb-payments`

- Produkcyjny `index.ts`: 22 109 znaków.
- `main` `index.ts`: 23 494 znaki w aktualnym odczycie.
- Produkcja nie zawiera importu i kontroli `providerReferenceMatches` obecnych na `main`.
- Produkcyjny kod nie zawiera warunku wymagającego uprzednio zapisanej referencji operatora.

## Wniosek operacyjny

Obie funkcje krytyczne dla sprzedaży są wdrożone w wersji 1 z 15 listopada i różnią się od aktualnego kodu repozytorium. Nie wykonywać zbiorczego wdrożenia. Najpierw:
1. porównać wszystkie pliki każdej funkcji, nie tylko `index.ts`;
2. przejrzeć historię zmian od 15 listopada i zależności między funkcjami;
3. uruchomić testy kontraktowe i regresyjne;
4. wykonać kontrolowane wdrożenie pojedynczej funkcji na sandboxie;
5. dopiero po pozytywnych testach rozważyć produkcję.

Nie wolno przy tym włączać operatorów płatności ani zmieniać trybu przedpremierowego.
