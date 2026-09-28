# TNB – Etap 1: Audyt architektury i plan dalszego rozwoju

Ten dokument to wyłącznie audyt i plan. Na tym etapie nie zmieniamy kodu, bazy danych ani wyglądu strony.

## 1. Stan obecny

- Stos: TanStack Start (React 19, Vite 7, renderowanie po stronie serwera), Tailwind v4, 46 gotowych komponentów interfejsu (shadcn/Radix), React Query, react-hook-form + zod, sonner (powiadomienia).
- Routing: jest tylko jedna strona, `/`. Całe menu opiera się na kotwicach (#biblioteka, #podcast…), a większość z nich nigdzie nie prowadzi.
- Komponenty strony (src/components/tnb): SiteHeader, Hero, QuickNav, PillarCards, QuoteNewsletter. Wszystkie teksty i linki są wpisane na stałe w kod.
- System wizualny: tokeny kolorów w styles.css (ciemne tło, złoto, surface/surface-deep), fonty Cormorant Garamond i Jost, klasy pomocnicze `eyebrow` i `nav-link`.
- Zdjęcia: to wycinki z wizualizacji w niskiej rozdzielczości, zapisane jako zasoby w chmurze.
- Baza danych, logowanie, role, integracje: brak. Lovable Cloud nie jest włączony.
- Newsletter: formularz pokazuje tylko komunikat i nigdzie nie zapisuje adresu.

## 2. Elementy gotowe

- Strona główna wiernie odwzorowuje wizualizację i działa na komputerze, tablecie i telefonie.
- Spójny system kolorów i typografii, gotowy do ponownego użycia w panelu.
- Nagłówek z menu mobilnym, sekcja hero, pasek 7 ikon, 3 karty, 3 kafelki, cytat i newsletter.
- Ustawione metadane SEO strony głównej i favicon.

## 3. Braki i problemy

Strona publiczna:
- Brak stopki (dane kontaktowe, linki prawne, media społecznościowe).
- Brak formularza kontaktowego i strony Kontakt.
- Brak podstron: O TNB, Moja historia, Biblioteka, Podcast, Społeczność, Spotkania, Sklep, Rozwój, Moje TNB.
- Brak stron informacyjnych: Polityka prywatności, Regulamin, Cookies (w tym banera zgody, wymaganego przez RODO).
- Niedziałające linki: Zaloguj się, Dołącz, Obejrzyj wideo, wyszukiwarka.
- Newsletter nie zapisuje adresów.
- Strona 404 jest po angielsku, a dokument HTML ma ustawiony język `lang="en"` zamiast `pl`.
- Zdjęcia w niskiej jakości, potrzebne oryginały.

Do przygotowania pod edycję przez administratora: wszystkie teksty hero, pozycje menu, 7 ikon QuickNav, karty i kafelki, cytat, newsletter, stopka, SEO i zdjęcia.

## 4. Rekomendowana architektura

```text
Strona publiczna (/ , /biblioteka, /podcast, /kontakt, /[strony])
        |  odczyt publicznych treści
Warstwa serwerowa (funkcje serwerowe, sprawdzanie uprawnień)
        |
Lovable Cloud: baza danych, logowanie, pliki, e-maile
        |
Panel administratora (/admin/*) – chroniony rolą
```

Główne założenia:
- Treść w bazie danych, a nie w kodzie. Strona składa się z sekcji (typ + dane JSON + kolejność). Obecne komponenty stają się szablonami sekcji zasilanymi danymi.
- Moduły: pages/sections (strony), posts (biblioteka i artykuły), podcast_episodes, media (biblioteka plików), events/bookings (spotkania 1:1), community (później), products/orders (sklep premium).
- Konta: logowanie przez e-mail i Google. Profil w osobnej tabeli, role w osobnej tabeli `user_roles`: admin, editor, moderator, member, premium.
- Dostęp do treści: każda treść ma poziom widoczności (publiczna / dla zalogowanych / premium), egzekwowany na poziomie bazy (RLS).
- Powiadomienia: e-maile transakcyjne i newsletter, później powiadomienia w aplikacji.
- Logi: tabela `audit_log` (kto, co, kiedy, przed/po) oraz wersje treści z możliwością przywrócenia.
- Integracje (później): płatności (Stripe/Paddle), odtwarzacz podcastów/RSS, YouTube, kalendarz do rezerwacji.

## 5. Struktura panelu administratora

- Pulpit: statystyki, ostatnie zmiany, zadania do moderacji.
- Strony: lista stron, edytor sekcji (dodawanie, kolejność, ukrywanie), podgląd, publikacja, wersje.
- Nawigacja: menu główne, menu mobilne, stopka.
- Biblioteka: artykuły, e-booki, wideo, muzyka, polecajki, a do tego kategorie i tagi.
- Podcast: odcinki, goście, sezony, pliki audio lub linki.
- Media: wgrywanie, foldery, opisy alt, wykorzystanie plików.
- Społeczność: posty, komentarze, zgłoszenia, moderacja.
- Spotkania 1:1: terminy, rezerwacje, statusy.
- Sklep / Premium: produkty, dostęp, zamówienia.
- Użytkownicy: lista, profile, blokady.
- Role i uprawnienia: przypisywanie ról, macierz uprawnień.
- Newsletter i kontakt: subskrybenci, eksport, wiadomości z formularza.
- Powiadomienia: szablony e-maili, wysyłki.
- SEO: metadane stron, przekierowania, mapa strony.
- Ustawienia: dane organizacji, social media, stopka, zgody i cookies.
- Historia zmian: dziennik działań i przywracanie wersji.

## 6. Plan etapów wdrożenia

Każdy etap kończy się testem strony publicznej i nie psuje tego, co już działa.

1. Porządki strony publicznej. Zakres: stopka, strona Kontakt z formularzem, Polityka prywatności, Regulamin i Cookies, polska strona 404, `lang="pl"`, podpięcie martwych linków do podstron-zaślepek. Zależności: brak (poza treściami od właściciela). Rezultat: kompletna, nawigowalna strona. Kryteria i testy: każdy link działa, podstrony mają własne SEO, test na 3 szerokościach ekranu. Ryzyko: brak treści prawnych.
2. Fundament backendu. Zakres: włączenie Lovable Cloud, zapis formularza kontaktowego i newslettera, e-mail z powiadomieniem. Zależności: etap 1. Testy: wysłanie formularza i zapis w bazie. Ryzyko: konfiguracja domeny e-mail.
3. Konta i role. Zakres: rejestracja i logowanie, profile, `user_roles`, chroniony `/admin` z pulpitem, dziennik zmian. Testy: zwykły użytkownik nie ma wstępu do panelu, test uprawnień RLS. Ryzyko: błędy uprawnień.
4. CMS stron i mediów. Zakres: tabele stron i sekcji, biblioteka mediów, przepięcie strony głównej na dane z bazy (wygląd 1:1), edytor sekcji, nawigacja i stopka edytowalne, wersjonowanie. Testy: porównanie zrzutów ekranu przed i po, edycja widoczna na stronie. Ryzyko: regresja wyglądu (największe ryzyko całego planu).
5. Biblioteka i Podcast. Zakres: moduły treści, listy, strony szczegółów, kategorie, poziomy dostępu. Testy: publikacja i widoczność według poziomu.
6. Spotkania 1:1. Zakres: rezerwacje i powiadomienia. Ryzyko: strefy czasowe i integracja z kalendarzem.
7. Premium i sklep. Zakres: płatności i dostęp do treści premium. Ryzyko: podatki, zwroty, zgodność prawna.
8. Społeczność. Zakres: posty, komentarze, moderacja, zgłoszenia. Ryzyko: moderacja i RODO.
9. Moje TNB. Zakres: profil, zapisane treści, postępy.

## 7. Ryzyka i zależności

- Treści od właściciela: teksty prawne, dane kontaktowe, oryginalne zdjęcia, wideo 2:18.
- Przejście strony głównej na CMS może zmienić wygląd, dlatego potrzebne są testy wizualne przed i po.
- Bezpieczeństwo: role w osobnej tabeli, RLS na każdej tabeli, uprawnienia sprawdzane po stronie serwera.
- RODO: zgody na newsletter, cookies, prawo do usunięcia konta.
- Płatności i społeczność to etapy o najwyższej złożoności, dlatego zaplanowano je na koniec.

## 8. Proponowana kolejność i pierwsze zadanie

Kolejność: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.

Pierwsze konkretne zadanie: Etap 1, punkt 1: zbudowanie stopki w stylu strony (logo, nawigacja, kontakt, linki prawne, social media) oraz strony `/kontakt` z formularzem (na razie tylko walidacja, zapis w bazie w etapie 2). Do tego potrzebne są od Ciebie: e-mail kontaktowy, linki do mediów społecznościowych i dane do stopki.
