# Etap 14 – Audyt i architektura Centrum Dowodzenia TNB

Raport z analizy. Nic nie zostało zmienione w aplikacji, bazie ani uprawnieniach.

## 1. Istniejące funkcje panelu i ich rzeczywisty stan

| Zakładka | Stan | Uwagi |
|---|---|---|
| Pulpit | Działa, ubogi | 6 liczników: wiadomości, subskrybenci, błędy powiadomień. Brak społeczności, zamówień, spotkań, rozmów 1:1 |
| Wiadomości | Działa | Filtry, wyszukiwanie, przeczytana/archiwum |
| Subskrybenci | Działa | Filtry, zgody, eksport. Brak wysyłki newslettera |
| Ustawienia e-mail | Zapisuje, ale nie wysyła | Wysyłka e-maili nie jest uruchomiona (brak domeny nadawcy) — każda wiadomość kończy się „Pominięto” |
| Społeczność | Działa | Ukrywanie, przywracanie, usuwanie, widoczność, zgłoszenia |
| Biblioteka | Działa | Pełne tworzenie/edycja, pliki, okładki, ceny |
| Zamówienia | Działa | Przelew, ręczne oznaczanie opłaty/dostawy/zwrotu z zapisem kto i kiedy |
| Spotkania | Działa | Wydarzenia, zgłoszenia, obecność, CSV |
| Rozmowy 1:1 | Działa częściowo | Dostępność i rezerwacje działają; przypomnienia 24 h nie uruchamiają się same |
| Podcast | Działa | Odcinki, pliki, dostęp |
| Historia powiadomień | Działa | Tylko e-maile do administratora |
| Strony | Działa | Edytor O TNB, Moja historia, własne podstrony |
| Treści strony | Atrapa | Tylko lista „wkrótce”; stopka, kontakt, dokumenty prawne i strona główna są wpisane w kodzie |

## 2. Brakujące funkcje

- Użytkownicy: brak listy kont, profili, blokowania, nadawania ról (role tylko ręcznie w bazie).
- Brak edycji strony głównej, nawigacji, stopki, danych kontaktowych i dokumentów prawnych.
- Brak biblioteki multimediów (pliki rozproszone w 4 osobnych magazynach, bez wspólnego przeglądu).
- Brak wysyłki newslettera i szablonów e-mail.
- Brak centralnego dziennika zdarzeń (są tylko 3 osobne historie: zamówienia, rozmowy 1:1, e-maile).
- Brak podglądu błędów aplikacji i integracji.
- Brak ekranu integracji (poczta, płatności online, harmonogram przypomnień).
- Brak danych do przelewu w panelu (wpisywane w kodzie).
- Brak ról pośrednich — jest tylko „admin” i „premium”.

## 3. Proponowana struktura Centrum Dowodzenia

```text
A. Pulpit i monitoring        -> Pulpit (rozbudowany), Zadania
B. Użytkownicy i role         -> Użytkownicy, Role (nowe)
C. Treści i moduły            -> Biblioteka, Podcast
D. Społeczność i moderacja    -> Posty i komentarze, Zgłoszenia
E. Spotkania i kalendarz      -> Spotkania, Rozmowy 1:1
F. Sprzedaż                   -> Zamówienia, Dane do przelewu
G. Komunikacja                -> Wiadomości, Subskrybenci, Historia e-maili
H. Wygląd i CMS               -> Strony, Strona główna i nawigacja, Multimedia
I. Integracje i konfiguracja  -> Poczta, Płatności, Harmonogramy, Ustawienia ogólne
J. Bezpieczeństwo i logi      -> Dziennik zdarzeń, Błędy, Dostęp
```

Istniejące zakładki przechodzą do grup bez zmiany ich działania. „Treści strony” zostaje zastąpiona sekcją H (bez duplikatu). Menu boczne dostaje nagłówki grup i liczniki „wymaga uwagi”.

## 4. Mapa połączeń panelu z modułami

```text
Wiadomości      <- formularz Kontakt
Subskrybenci    <- newsletter na stronie głównej
Społeczność     <- /spolecznosc (posty, komentarze, reakcje, zgłoszenia)
Biblioteka      <- /biblioteka, /materialy-premium
Zamówienia      <- przycisk „Kup materiał”, /zakup/...
Spotkania       <- /spotkania, zgłoszenia uczestników
Rozmowy 1:1     <- /spotkania/rozmowa-1-1, Moje TNB
Podcast         <- /podcast
Strony          <- /o-tnb, /moja-historia, /strony/...
Powiadomienia   <- Kontakt, newsletter (e-maile do admina)
```

## 5. Główny pulpit — wskaźniki (tylko prawdziwe dane)

- Użytkownicy: łącznie, nowi w 7/30 dni.
- Społeczność: posty i komentarze w okresie, otwarte zgłoszenia, ukryte treści.
- Treści: opublikowane materiały, odcinki, strony; szkice.
- Spotkania: najbliższe wydarzenia, zgłoszenia oczekujące na decyzję, rozmowy 1:1 na 7 dni.
- Sprzedaż: zamówienia oczekujące na płatność, opłacone niedostarczone, suma opłaconych w miesiącu.
- Komunikacja: nowe wiadomości, nieudane/pominięte e-maile.
- Problemy: brak konfiguracji poczty, brak danych do przelewu, brak dostępności 1:1, błędy.
- „Zadania dla Ciebie”: lista konkretnych spraw z linkami.
- Ostatnie zdarzenia: 10 wpisów z dziennika.

Każdy kafelek prowadzi do odpowiedniej zakładki z ustawionym filtrem. Bez wykresów, dopóki nie ma wystarczająco danych.

## 6. Docelowy model ról

| Rola | Zakres |
|---|---|
| Superadministrator | Wszystko, w tym role, integracje i logi |
| Administrator | Wszystkie moduły poza rolami i integracjami |
| Moderator | Społeczność i zgłoszenia |
| Redaktor | Strony, Biblioteka, Podcast, Spotkania (treść) |
| Obsługa użytkowników | Wiadomości, subskrybenci, zgłoszenia na spotkania, rozmowy 1:1, zamówienia (podgląd) |

Rozbudowa obecnego mechanizmu, bez nowego systemu: nowe wartości ról w tej samej tabeli ról oraz jedna funkcja sprawdzająca „czy osoba ma dostęp do obszaru X”. Obecne „admin” staje się superadministratorem — nikt nie traci dostępu. Każda funkcja serwera sprawdza obszar, a baza powtarza tę samą regułę. Role nadaje tylko superadministrator, z wpisem w dzienniku.

## 7. Monitoring i dziennik zdarzeń

Jedna tabela zdarzeń: data, typ, kto, obiekt (rodzaj + id), wynik, krótki opis. Zapisywana wyłącznie przez serwer, czytana tylko przez superadministratora (i częściowo administratora). Bez haseł, treści rozmów 1:1 i pełnych adresów e-mail w opisach. Obejmuje: logowania i nieudane logowania (z dziennika logowań systemu), zmiany ról, publikacje, edycje, usunięcia, archiwizacje, zamówienia, rezerwacje, moderację, błędy e-maili i integracji, błędy krytyczne. Istniejące historie zamówień i rozmów zostają — dziennik je uzupełnia, nie zastępuje. Przechowywanie: 12 miesięcy.

## 8. Problemy techniczne i konflikty

- Sprawdzanie uprawnień administratora jest skopiowane w 7 plikach — do scalenia w jedno miejsce przed wprowadzeniem nowych ról.
- Brak tabeli profili — imię i nick są tylko w danych konta; lista użytkowników wymaga bezpiecznej funkcji serwera.
- Wysyłka e-maili nieaktywna — pulpit będzie stale pokazywał ostrzeżenie do czasu podłączenia domeny.
- Przypomnienia 1:1 bez harmonogramu.
- Dane do przelewu, stopka i kontakt zapisane w kodzie — zmiana wymaga programisty.
- W bazie jest uprawnienie admina dla nieistniejącego konta; konto sebastiansnopek87@gmail.com nie ma uprawnień admina.
- Menu boczne ma 13 pozycji bez grup — przy kolejnych zakładkach stanie się nieczytelne.
- Pozostałości po Stripe w bazie (nieużywane pola) — bezpieczne, do usunięcia w przyszłości.

## 9. Kolejność wdrażania

1. Wspólne sprawdzanie uprawnień + dziennik zdarzeń (podstawa dla reszty).
2. Nowy układ menu z grupami (bez zmiany zakładek).
3. Rozbudowany pulpit z zadaniami.
4. Użytkownicy i role (lista, profile, nadawanie ról).
5. Ustawienia platformy: dane do przelewu, kontakt, stopka, integracje.
6. Strona główna, nawigacja, dokumenty prawne, multimedia.
7. Komunikacja: newsletter, szablony (po podłączeniu domeny e-mail).
8. Diagnostyka: podgląd błędów, harmonogram przypomnień.

## 10. Zachować / rozbudować / uporządkować

- Zachować bez zmian: Biblioteka, Zamówienia, Spotkania, Rozmowy 1:1, Podcast, Strony, Wiadomości.
- Rozbudować: Pulpit, Subskrybenci (wysyłka), Społeczność (osobna kolejka zgłoszeń), Historia powiadomień (włączyć do dziennika).
- Uporządkować: menu boczne, sprawdzanie uprawnień, Ustawienia e-mail (do sekcji Integracje).
- Zastąpić: „Treści strony” (atrapa) sekcją H.

Po akceptacji zacznę od punktu 1 kolejności wdrażania.
