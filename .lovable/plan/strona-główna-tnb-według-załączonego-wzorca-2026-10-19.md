# Strona główna TNB według załączonego wzorca

## Potwierdzone braki obecnego edytora
- Strona główna nie korzysta z CMS. `src/routes/index.tsx` składa ją z elementów zapisanych w kodzie, a rejestr Visual Buildera oznacza ten ekran jako nieobsługiwany.
- Obecny element listy ma tylko tytuł i opis (`PageItem` w `src/lib/pages.ts`). Nie przechowuje własnego obrazu, adresu, ikony, widoczności ani kadrowania.
- Przyciski mają tylko tekst i adres, bez osobnego stylu i widoczności. Nagłówek jest współdzielony i nie jest edytowany w Visual Builderze.
- Zwykła sekcja otwierająca stronę nie obsługuje filmowej kompozycji pięciu scen. Samo wpisanie tekstów do istniejących bloków nie spełni wymagań wzorca.

## Najmniejsza bezpieczna zmiana
Rozszerzyć istniejące bloki i ich ustawienia zapisane w polu JSON CMS. Bez nowych tabel, migracji, drugiego edytora ani zmiany uprawnień. Ten zakres wymaga rozszerzenia modelu i formularzy obecnego Visual Buildera, nie tylko zmiany wyglądu strony.

## Efekt
1. Dodać stronę główną jako stronę systemową ze stałym adresem `/` w istniejącym `/admin/strony`.
2. Dodać wariant filmowego otwarcia i pasa wartości do wspólnego renderowania CMS oraz podglądu Visual Buildera.
3. Przygotować pięć osobnych, wymiennych obrazów przedstawiających etapy życia ze wzorca. Nie używać zrzutu jako tła ani nie generować napisów wewnątrz obrazów. Są to sceny ilustracyjne, nie deklarowane wspomnienia autora.
4. Każda scena: własne teksty, obraz, opis alternatywny, adres, kadrowanie, wyrównanie i widoczność; możliwość zmiany kolejności, duplikowania i usuwania. Każda wartość: własne teksty i wybierana ikona. Przyciski: tekst, adres, wariant i widoczność.
5. Wykorzystać obecny edytor formatowania tekstów; dodać brakujące kontrolki rozmiarów, odstępów, szerokości i wyglądu o ograniczonych, walidowanych wartościach. Kolory wykorzystują paletę TNB, bez dowolnego CSS i HTML.
6. Dla strony głównej przygotować nagłówek zgodny ze wzorcem: poziome linki na desktopie, menu rozwijane na mniejszych ekranach. Etykiety, kolejność i widoczność linków oraz wygląd tego wariantu edytowane w obecnym Visual Builderze. Logo i nazwa nadal pochodzą z istniejących ustawień marki; wyszukiwanie i stan logowania zachowują obecne działanie. Nagłówki pozostałych stron bez przebudowy.
7. Zachować wszystkie sekcje poniżej odtwarzanego ekranu, stopkę, adresy, przełączniki modułów i funkcje aplikacji.

## Szkic i publikacja
- Nowy wygląd zapisać wyłącznie jako szkic w obecnym CMS, z historią wersji; administrator ogląda go w Visual Builderze.
- Publiczna strona nadal pokazuje dotychczasowy ekran do chwili jawnej publikacji przez administratora. Nie zastępować jej nowym wyglądem przez obejście statusu szkicu.
- Jeśli strona główna już istnieje w CMS, zachować jej wcześniejszą wersję przed zapisaniem nowego szkicu.
- Nie publikować automatycznie strony ani aplikacji. Nie zmieniać dokumentów prawnych, ról, RLS, zamówień ani danych użytkowników.

## Szczegóły techniczne
- Rozszerzenie `PageSection`, `PageItem` i `PageButton` o opcjonalne, walidowane ustawienia; starsze strony dostają zachowawcze wartości domyślne.
- Rozszerzenie rejestru bloków, Inspector, wyboru/pozycjonowania elementów i wspólnego renderera. Własne media wykorzystują obecny przepływ prywatnych obrazów CMS; nowe grafiki projektowe używają istniejącego przepływu zasobów.
- Zapisy, publikacja i przywracanie używają obecnych funkcji CMS z istniejącą kontrolą administratora i dziennikiem. Pola nowych elementów muszą przetrwać walidację serwera, zapis szkicu, wersje oraz odczyt publiczny.
- Odczyt `/` korzysta z opublikowanej strony systemowej; brak takiej wersji zachowuje obecny ekran. Metadane strony głównej pozostają właściwe dla TNB.

## Sprawdzenie i raport
- Testy walidacji nowych pól, niezależności elementów, zapisu/odczytu szkicu, publikacji i odtworzenia wcześniejszej wersji oraz zgodności starszych bloków.
- Zalogowane sprawdzenie rzeczywistego zapisu szkicu, odświeżenia i ponownego otwarcia edytora; bez publikacji. Publikację i przywrócenie sprawdzić w testach bez zmieniania publicznej wersji.
- Porównanie ze wzorcem na desktopie i sprawdzenie telefonu/tabletu: obrazy, czytelność, linki, wybór elementów i brak poziomego przewijania.
- Uruchomić odpowiednie testy i sprawdzić wynik automatycznej kompilacji. Raport poda pliki, miejsca edycji, rzeczywiste wyniki, ograniczenia oraz potwierdzenie zapisu wyłącznie jako szkic.