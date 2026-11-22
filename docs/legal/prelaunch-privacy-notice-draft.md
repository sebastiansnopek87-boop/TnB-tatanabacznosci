# Projekt informacji o przetwarzaniu danych — lista przedpremierowa TNB

**Status: DRAFT — nie publikować bez uzupełnienia danych administratora i akceptacji właściciela.**

## Administrator danych

- Pełna nazwa / imię i nazwisko: **[DO UZUPEŁNIENIA]**
- Forma prawna: **[DO UZUPEŁNIENIA]**
- Adres: **[DO UZUPEŁNIENIA]**
- E-mail kontaktowy: **[DO UZUPEŁNIENIA]**
- Inspektor ochrony danych (jeśli został wyznaczony): **[DO UZUPEŁNIENIA / NIE DOTYCZY]**

W aktualnym rekordzie `platform_settings` pola nazwy prawnej, adresu i kontaktowego e-maila są puste. Nie wolno publikować polityki z domyślnymi lub wymyślonymi danymi.

## Cel i podstawa

Dane są zbierane wyłącznie po to, aby wysłać jednorazową wiadomość e-mail z informacją o uruchomieniu platformy Tata Na Baczności. Podstawą przetwarzania imienia i adresu e-mail w celu wysłania jednorazowej informacji jest zgoda osoby, której dane dotyczą (art. 6 ust. 1 lit. a RODO). Ograniczanie nadużyć z użyciem skrótu IP i user-agenta powinno być opisane jako odrębny cel oparty na prawnie uzasadnionym interesie administratora (art. 6 ust. 1 lit. f RODO), po przeprowadzeniu oceny równowagi interesów. Zapis nie oznacza subskrypcji newslettera ani zgody na inne wiadomości marketingowe.

## Zakres danych

- imię;
- adres e-mail;
- data i wersja udzielonej zgody oraz zapisany tekst zgody;
- techniczny skrót IP używany do ograniczania nadużyć;
- user-agent przeglądarki.

Nie zapisujemy pełnego adresu IP w tabeli listy przedpremierowej. Skrót IP jest liczony z użyciem HMAC z kluczem serwerowym i służy wyłącznie do ograniczania nadużyć. User-agent jest przechowywany w skróconej postaci technicznej.

## Odbiorcy i miejsce przechowywania

Dane listy są przechowywane w projekcie Supabase TNB w regionie `eu-west-3` (Paryż). Tabela ma RLS bez polityk, a bezpośredni dostęp anon/authenticated jest odebrany; operacje wykonuje wyłącznie Edge Function z rolą service_role.

Dostawca poczty nie jest obecnie skonfigurowany. Przed wysyłką trzeba uzupełnić nazwę dostawcy, zakres przetwarzania i ewentualne informacje o transferach poza EOG. Nie deklarować braku transferów, dopóki dostawca nie zostanie wybrany i zweryfikowany.

## Okres przechowywania — do zatwierdzenia

Proponowany okres:
- do wysłania jednorazowej informacji o starcie lub do wycofania zgody;
- po wysłaniu informacji usunięcie danych z aktywnej listy w ciągu 30 dni, z uwzględnieniem kopii zapasowych;
- jeśli platforma nie zostanie uruchomiona, usunięcie nieaktywnych zapisów po 12 miesiącach.

**Właściciel musi zatwierdzić albo zmienić te terminy przed publikacją.**

## Prawa osoby

Osoba może wycofać zgodę w dowolnym momencie, bez wpływu na zgodność przetwarzania sprzed wycofania. Może również skorzystać z praw dostępu, sprostowania, usunięcia, ograniczenia przetwarzania i złożyć skargę do Prezesa UODO.

Link wycofania zgody jest udostępniany po zapisie. Jeśli link zostanie utracony, osoba może skontaktować się przez formularz kontaktowy — po uruchomieniu formularza musi być dostępny kontakt administratora.

## Dobrowolność i automatyzacja

Podanie danych jest dobrowolne. Bez imienia, adresu e-mail i zgody nie można dopisać osoby do listy. Dane nie są wykorzystywane do profilowania ani zautomatyzowanego podejmowania decyzji.

## Do zatwierdzenia przed publikacją

1. Dane administratora: nazwa/imię i nazwisko, forma prawna, adres, kontaktowy e-mail.
2. Proponowany okres retencji (30 dni po wysłaniu / 12 miesięcy bez uruchomienia).
3. Wybrany dostawca poczty i jego lokalizacja przetwarzania.
4. Czy administrator wyznaczył IOD.
5. Ostateczna treść i wersja dokumentu prawnego.
