# SMTP Cyber_Folks — konfiguracja produkcyjna

Aplikacja korzysta z jednego transportu SMTP po stronie Supabase Edge Functions. Dane logowania nie są przechowywane w repozytorium, bazie danych ani w przeglądarce.

## Dane wymagane z panelu hostingu

W panelu Cyber_Folks otwórz właściwą usługę hostingową i odczytaj dokładną nazwę serwera poczty wychodzącej. Nie zakładaj, że jest to `smtp.tatanabacznosci.pl` — nazwa zależy od konkretnego serwera i konfiguracji usługi.

Utwórz/wybierz skrzynkę nadawczą w domenie `tatanabacznosci.pl`. Login SMTP to pełny adres e-mail skrzynki.

## Sekrety Supabase Edge Functions

W projekcie Supabase `pmdfiipontreuclfumdh` dodaj sekrety:

| Nazwa | Wartość |
|---|---|
| `SMTP_HOST` | dokładny host SMTP z panelu Cyber_Folks |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USERNAME` | pełny adres skrzynki, np. `kontakt@tatanabacznosci.pl` |
| `SMTP_PASSWORD` | hasło tej skrzynki |
| `SMTP_FROM` | pełny adres nadawcy zgodny ze skrzynką |

Nie wpisuj hasła do plików, commitów, ustawień publicznych Vite ani formularzy panelu administratora. Nie przesyłaj go w rozmowie.

**Ważne:** Cyber_Folks oferuje SMTP na porcie 465 z SSL/TLS oraz 587 z STARTTLS. Supabase Edge Functions blokują ruch wychodzący na port 587 i 25, dlatego dla połączenia z Edge Functions używamy 465/SSL. Jeśli panel hostingu wskazuje inny host, użyj wartości z panelu, nie przykładowej nazwy.

## Supabase Auth

SMTP używany przez Edge Functions i SMTP używany przez Supabase Auth to dwie osobne konfiguracje.

W Supabase Dashboard przejdź do Authentication → SMTP Settings i wpisz ten sam host, port 465, login, hasło oraz adres nadawcy. Dzięki temu wiadomości potwierdzające rejestrację, reset hasła, magic linki i zaproszenia będą wysyłane przez skrzynkę domenową, a nie przez ograniczony serwer testowy Supabase.

## DNS i nadawca

Przed wysyłką produkcyjną sprawdź w panelu hostingu rekordy SPF i DKIM dla domeny oraz dodaj/uzupełnij DMARC zgodnie z polityką domeny. Nie kopiuj rekordów z innego hostingu — użyj wartości wygenerowanych dla tej usługi.

## Włączenie wysyłki

1. Najpierw dodaj sekrety Edge Functions i ustaw SMTP w Supabase Auth.
2. Uruchom test SMTP z panelu administratora, używając własnego adresu kontrolnego.
3. Potwierdź odbiór wiadomości, poprawny nadawca, odpowiedź Reply-To i brak błędów w historii.
4. Dopiero wtedy w panelu TNB przełącz tryb na „Rzeczywista wysyłka”.

Dopóki brakuje sekretów lub tryb pozostaje testowy, system zapisuje wiadomości jako symulacje i nie wysyła ich do odbiorców. Kod nie włącza wysyłki produkcyjnej samoczynnie.

## Zakres transportu

Wspólny transport `supabase/functions/_shared/smtp.ts` obsługuje:
- powiadomienia administracyjne i testy szablonów,
- wiadomości o zamówieniach i dostępie do materiałów,
- potwierdzenia/rezerwacje konsultacji,
- zgłoszenia kontaktowe i powiadomienia o zapisie do newslettera,
- linki do bezpłatnych materiałów,
- newslettery artykułowe.

Każdy przepływ zachowuje swój dotychczasowy log, statusy, reguły zdarzeń i klucze idempotencji. Wysłanie do serwera SMTP oznacza przyjęcie wiadomości przez serwer; nie jest samo w sobie potwierdzeniem dostarczenia do skrzynki odbiorcy.
