# Strona główna w Visual Builderze — jeden wygląd dla strony i edytora

## Stan obecny (inwentaryzacja, etap A)
- Strona `/` jest w całości zapisana w kodzie: Hero, Artykuły, Rozmowy społeczności, Skróty, Filary, Cytat + newsletter, nagłówek i stopka. Nie czyta żadnego rekordu CMS.
- Visual Builder renderuje strony CMS własnym zestawem 7 prostych bloków (otwarcie, tekst, karty, kolumny, cytat, zdjęcie, CTA). Żaden z nich nie odpowiada sekcjom strony głównej, dlatego podgląd „nijak się ma” do strony.
- Rejestr edytora sam to przyznaje: „Strona główna — układ zapisany w kodzie”.
- Szkice, wersje, przywracanie i publikacja już działają dla stron CMS i można je wykorzystać bez nowych tabel.

## Co zbudujemy (etapy B–D)

**1. Wspólne sekcje strony głównej.** Każda obecna sekcja dostaje swoją treść jako dane, a dzisiejsze teksty i zdjęcia stają się wartościami domyślnymi. Ten sam komponent renderuje stronę publiczną i podgląd w edytorze — żadnej makiety.

| Sekcja | Edytowalne w edytorze | Zostaje w module |
|---|---|---|
| Otwarcie (Hero) | nadtytuł, 3 linie nagłówka, opis, przycisk, zdjęcie + kadr + opis alt, prawa kolumna, cytat, link społeczności | widoczność modułów |
| Artykuły | nagłówek, opis, liczba kart, link „wszystkie” | same artykuły (moduł Artykuły) |
| Rozmowy społeczności | nagłówek, opis, liczba, link | wpisy i moderacja |
| Skróty nawigacyjne | etykiety, linki, kolejność | — |
| Filary i karty | tytuły, opisy, zdjęcia, linki | — |
| Cytat i newsletter | cytat, autor, nagłówek i opis zapisu | zapis i zgody newslettera |

Każdą sekcję można przesunąć, ukryć, zduplikować (gdzie ma to sens) i usunąć; wspólne ustawienia wyglądu: wyrównanie, odstęp, szerokość, tło.

**2. Strona główna w panelu „Strony”.** Pozycja „Strona główna — /” z przyciskiem „Utwórz szkic z obecnej strony”, który kopiuje dzisiejszy wygląd do szkicu (nic nie publikuje).

**3. Bezpieczne przełączenie.** `/` pokazuje opublikowaną wersję CMS tylko wtedy, gdy istnieje i jest kompletna; w przeciwnym razie dokładnie dzisiejszą stronę. Szkic nigdy nie trafia na stronę publiczną.

**4. Przełącznik „Niezalogowany / Zalogowany”** w pasku edytora — zmienia tylko podgląd (np. przyciski dołączenia, sekcje dla zalogowanych), oznaczony jako symulacja; sesja administratora bez zmian.

**5. Kliknięcie w podglądzie** zaznacza konkretne pole (stałe identyfikatory, nie tekst); linki, formularz newslettera i przyciski w edytorze są wyłączone.

## Poza tym etapem (wyraźnie oznaczone w raporcie)
- Nagłówek, menu i stopka są globalne dla całej witryny — w edytorze widoczne, ale oznaczone „globalne, edycja w Ustawieniach”. Ich edycja wizualna to osobny etap.
- Filmowa sekcja „pięć etapów życia” z wzorca 19 października — osobny krok po tym etapie.

## Testy (etap E)
Strona `/` bez publikacji wygląda identycznie (porównanie zrzutów przed/po); zmiana tekstu i zdjęcia przetrwa odświeżenie; kolejność i ukrycie trwałe; szkic nie zmienia `/`; publikacja pokazuje dokładnie tę wersję; przywrócenie wersji; przełącznik widoku; telefon/tablet/komputer; regresja `/o-tnb`, `/moja-historia`, stron prawnych; istniejące testy CMS i Centrum kontroli.

## Szczegóły techniczne
- Nowe rodzaje sekcji (`home_hero`, `home_articles`, `home_community`, `home_quicknav`, `home_pillars`, `home_quote_newsletter`) w istniejącym JSON `site_pages.sections`, z polem `settings` na treść; `normalizeSections` uzupełnia domyślne wartości. Bez migracji i nowych tabel.
- `SYSTEM_PAGES.home = { path: "/" }`; rekord tworzony jedynie kliknięciem administratora (serwerowo, `assertAdmin` + `logEvent`).
- `HomeRenderer` używany przez `src/routes/index.tsx` i przez `PageView`/Frame w edytorze; loader `/` czyta tylko opublikowane kolumny (`getPublicPage`), fallback = obecny układ.
- Przełącznik widoku: `PreviewViewerContext` nadpisujący wynik `useAuth()` wyłącznie wewnątrz ramki podglądu.
- Bez zmian RLS, ról, płatności, danych; bez publikacji aplikacji.
