# Edytowalny slogan marki TNB

## Diagnoza

- **Aktualne logo nie zawiera sloganu.** Oba zapisane obrazy — „Logo strony” i „Obraz w nagłówku” — przedstawiają miedziany sygnet TNB bez dopisku. Nie trzeba zmieniać ani przetwarzać grafiki.
- **Nagłówek:** „Ojcostwo to służba” jest osobnym tekstem wpisanym na stałe w `SiteHeader.tsx`, pod nazwą marki.
- **Otwarte menu:** ten sam tekst jest wpisany na stałe jako dolne domknięcie w `SiteHeader.tsx`.
- **Stopka:** osobny, stały tekst pod nazwą marki w `SiteFooter.tsx`.
- **Logowanie i rejestracja:** wspólny `AuthShell` korzysta już z logo ustawionego w panelu, ale obecnie nie wyświetla osobnego sloganu.
- **Ustawienia marki:** nie mają wartości sloganu ani przełącznika widoczności. Visual Builder nie obejmuje nagłówka, menu, stopki i formularzy autoryzacji, dlatego nie pozwala edytować tego tekstu.
- **Inne wystąpienia:** domyślny tytuł strony głównej i opis ogólny w metadanych oraz przykład w polu SEO. To oddzielne teksty SEO, nie dopiski do logo. Obecny publiczny tytuł zapisany w panelu to „Tata Na Baczności”, bez sloganu; nie nadpisywać SEO przy zmianie sloganu.

## Minimalna zmiana

1. W istniejącym bloku **Wygląd i tożsamość strony** dodać pole **Slogan marki** i przełącznik **Pokaż slogan**.
2. Przechowywać oba ustawienia w istniejącym `brand_settings`, bez nowych tabel i bez drugiego mechanizmu konfiguracji.
3. Nagłówek, dolny dopisek menu i stopka odczytują ten sam slogan. Wspólny ekran logowania/rejestracji korzysta z tego samego ustawienia dla osobnego dopisku przy logo.
4. Wyłączony lub pusty slogan nie jest renderowany; jego odstępy również znikają. Logo i jego proporcje pozostają niezmienione.
5. Zachować wszystkie dotychczasowe ustawienia marki, zapis wyłącznie przez uprawnionego superadministratora oraz obecny dziennik zdarzeń.
6. Sprawdzić zmianę tekstu, wyłączenie, odczyt po odświeżeniu oraz nagłówek/menu/stopkę/logowanie/rejestrację na komputerze i telefonie 390 px. Nie wysyłać formularzy logowania ani nie zmieniać użytkowników.

## Baza i zgoda

**Migracja jest wymagana:** wdrożona walidacja bazy odrzuca wszystkie nieznane klucze w `brand_settings`, więc samo dodanie pól do panelu nie pozwoli ich zapisać.

Potrzebna jest wyłącznie aktualizacja tej walidacji, dopuszczająca publiczny tekst sloganu i wartość logiczną widoczności. Bez nowych tabel, kolumn, zmian istniejących danych, uprawnień ani osłabienia pozostałych reguł bezpieczeństwa.

**Nie wykonano migracji ani zmian aplikacji.** Po akceptacji kierunku przedstawić finalny SQL; wykonanie migracji wymaga osobnej zgody właściciela.

## Szczegóły techniczne

- Klucze: `brand_settings.slogan` (zwykły tekst, do 200 znaków) i `brand_settings.show_slogan` (boolean).
- Odczyt przez istniejące `useBrand`; wspólny warunek: przełącznik włączony oraz niepusty tekst po przycięciu.
- Rozszerzyć istniejący schemat serwerowego zapisu i funkcję `brand_settings_are_public(jsonb)`, zachowując listę dozwolonych kluczy, limit 12 KB oraz walidację wszystkich dotychczasowych wartości.
- Nie zmieniać Visual Buildera, SEO, plików logo, favicon, obrazu udostępniania, logiki autoryzacji ani innych sekcji strony.