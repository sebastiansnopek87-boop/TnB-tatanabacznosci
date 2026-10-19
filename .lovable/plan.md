# Jedna filmowa sekcja na istniejącej stronie głównej

## Zakres
- Dodać jeden filmowy blok do istniejącego edytora strony głównej, bez nowej strony, trasy, tabeli ani przebudowy CMS.
- Umieścić go na początku istniejącego szkicu, pod dotychczasowym nagłówkiem i menu. Zachować również obecne otwarcie „Czuwaj” poniżej — zgodnie z wcześniejszym wymaganiem zachowania dotychczasowej treści.
- Nie zmieniać publicznej wersji `/`. Nowy wygląd będzie dostępny w podglądzie szkicu; jego pokazanie na publicznej stronie wymaga osobnej zgody na publikację.

## Wygląd i edycja
- Pięć oddzielnych, realistycznych zdjęć filmowych odpowiadających pięciu etapom z załącznika; nie używać zrzutu jako zdjęcia całej sekcji.
- Osobne nagłówki i opisy scen, centralny nagłówek „RÓŻNE DROGI. TEN SAM KIERUNEK.”, podany opis, dwa przyciski do istniejących `/spolecznosc` i `/o-tnb` oraz dolny pas pięciu wartości.
- Czerń, grafit i stara miedź ograniczone do nowej sekcji. Na telefonie czytelne sceny w pionowym układzie, bez pomniejszania całości i bez przepełnienia.
- Edycja pięciu zdjęć, nagłówków i opisów, obu części głównego nagłówka, opisu, tekstów i adresów przycisków, pięciu wartości, widoczności i podstawowych ustawień wyglądu przez obecny mechanizm szkicu i wersji.
- Krótkie opisy scen oprzeć na tekście z referencji; traktować je jako ogólne sytuacje, nie wspomnienia autora.

## Zachowane elementy
Nie zmieniać nagłówka, menu, dotychczasowego otwarcia, artykułów, rozmów, skrótów, filarów, kafelków, cytatu/newslettera ani stopki. Zachować ich wzajemną kolejność, źródła danych, linki i uprawnienia. Pozostałe podstrony bez zmian.

## Szczegóły techniczne
- Właściwy punkt wstawienia: pierwszy blok `PageView` → `HomeBlock` w sekcjach istniejącego szkicu `home`; `PageView` już używa istniejącego `SiteHeader`.
- Jeden dodatkowy typ bloku w obecnej rejestracji; zdjęcia i opisy w `PageSection.items`, pozostałe pola w `settings`. Bez zmiany schematu `site_pages` i bez zmiany publicznego loadera `/` ani domyślnych siedmiu sekcji.
- Ten sam komponent React w edytorze i na `/` po przyszłej jawnej publikacji; dotychczasowy zapis, wersjonowanie i bezpieczne przesyłanie zdjęć.

## Weryfikacja i raport
- Uruchomić istniejące testy stron i regresje Centrum kontroli oraz sprawdzić wynik kompilacji.
- Sprawdzić podgląd nowej sekcji na komputerze, tablecie i telefonie, zdjęcia, przyciski i brak przepełnienia.
- Sprawdzić zapis/ponowne otwarcie istniejącego szkicu i zachowanie wszystkich wcześniejszych sekcji; bez publikowania i bez wysyłania newslettera.
- Porównać publiczną `/` przed i po: ma pozostać niezmieniona. Nie deklarować weryfikacji nowej sekcji na publicznej `/`, skoro publikacja jest zakazana.
- Raport: zmienione pliki, miejsce wstawienia, zachowane sekcje, rzeczywiste wyniki testów i ewentualne ograniczenia edycji.