# Ustawienia logo i ikon TNB

## Zakres
Rozbudować istniejące **Panel → Ustawienia platformy**, zachowując obecny wygląd TNB i przełączniki widoczności modułów.

1. **Logo strony** — podgląd aktualnego logo, wybór pliku z urządzenia albo adresu HTTPS, zapis i przywrócenie obecnego logo TNB. Jeden zapis aktualizuje logo w nagłówku, stopce, logowaniu i innych miejscach pokazujących znak marki.
2. **Zdjęcie/znak w nagłówku** — wybór obrazu i jego rozmiaru, odpowiadający polom widocznym na początku nagrania; bez zmiany układu strony ani zdjęcia głównego.
3. **Ikona przeglądarki (favicon)** — podgląd, przesłanie pliku lub adres HTTPS, zapis. Ikona widoczna w karcie przeglądarki po odświeżeniu.
4. **Obraz udostępniania** — podgląd i zmiana obrazu pokazywanego przy udostępnianiu strony głównej; zalecane proporcje 1200 × 630.
5. **Ustawienia udostępniania / SEO strony głównej** — tytuł, opis i nazwa witryny jak na nagraniu. Podstrony zachowują własne tytuły i opisy; artykuły zachowują swoje okładki.
6. **Adres witryny** — pokazać aktualny adres do skopiowania. Nie zmieniać adresów logowania, płatności ani wiadomości e-mail przez to pole. Publikacja i domena pozostają osobną decyzją właściciela.

## Zachowanie i bezpieczeństwo
- Zmiany zapisuje tylko superadministrator; pozostali administratorzy mają podgląd.
- Każda zmiana jest zapisana w dzienniku zdarzeń.
- Sprawdzenie formatu, wielkości i poprawności obrazu przed zapisem; czytelne błędy i stan zapisywania. Nieudane przesłanie nie zastępuje działającego obrazu.
- Obecne logo pozostaje domyślne, dopóki właściciel sam nie zapisze nowego.
- Bez fikcyjnych obrazów, nowego modułu, publikacji ani uruchamiania poczty.
- Istniejące PDF-y pozostają bez zmian. Nowe PDF-y korzystają z aktualnie wybranego logo, po bezpiecznym przygotowaniu obrazu do znaku wodnego.

## Szczegóły techniczne i zgoda na bazę
**Realizacja wymaga jednej migracji rozszerzającej istniejący rekord ustawień platformy** o ustawienia marki i udostępniania. Nie powstają nowe katalogi treści ani drugi panel. Migracja obejmuje uprawnienia odczytu wyłącznie bezpiecznych pól; zapis pozostaje chroniony po stronie serwera.

**Zatwierdzenie tego planu oznacza zgodę na tę jedną migrację.** Żadna kolejna migracja nie zostanie wykonana bez osobnej zgody.

Pliki trafią do istniejącego prywatnego magazynu, a publiczne obrazy będą udostępniane wyłącznie przez kontrolowany adres. Obrazy z podanego URL będą sprawdzane; niedozwolone adresy prywatne i niepoprawne pliki zostaną odrzucone. Wspólne źródło ustawień zasili logo, favicon oraz podgląd udostępniania.

## Weryfikacja
- Test przesłania logo, zapisu, odświeżenia i wyświetlenia na stronie oraz ekranie logowania.
- Test favicon i obrazu udostępniania w wygenerowanych danych strony.
- Test rozmiaru znaku w nagłówku, błędnego pliku, niedozwolonego URL i przywrócenia obecnego logo.
- Test odmowy zapisu osobie bez wymaganych uprawnień oraz zapisu w dzienniku.
- Test widoku komputera i telefonu 390 px, bez nakładania się pól.
- Raport wyników; nieprzetestowane zachowania oznaczone wprost, w tym odświeżanie podglądu przez zewnętrzne serwisy społecznościowe.