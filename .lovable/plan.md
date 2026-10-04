# ETAP 40 — TNB Visual Builder, wersja 1 (strony CMS)

## Analiza obecnego stanu (bez zmian w kodzie)

- „Strony i edytor treści” to jeden formularz: lista stron + edytor bloków (7 typów) + osobny „Podgląd”.
- Publiczna strona i podgląd korzystają z tego samego komponentu wyświetlającego (PageView). Builder użyje dokładnie tego komponentu — bez kopii.
- Zapis trafia od razu do tej samej treści, którą widzą odwiedzający. Gdy strona jest opublikowana, każde „Zapisz” jest od razu publiczne. Nie ma historii wersji ani cofania.
- Bloki są płaską listą sekcji (bez zagnieżdżania). Edycja Artykułów korzysta z tego samego edytora bloków.

Wniosek: komponent wyświetlający, bloki, zdjęcia, walidację i uprawnienia można rozbudować. Nową architekturę wymagają tylko dwie rzeczy: osobny szkic (żeby zapis nie publikował) oraz historia wersji.

## Co powstanie w wersji 1

Ten sam moduł, ten sam adres (/admin/strony). Przycisk „Edytuj wizualnie” przy każdej stronie otwiera tryb pełnoekranowy. Dotychczasowy formularz zostaje jako „Widok formularza”. Oba widoki zmieniają te same dane.

```text
+----------------------------------------------------------------------+
| ← Strony | Tytuł strony | Szkic zapisany 20:14 | [PC][Tablet][Tel] | Cofnij Ponów | Zapisz szkic | Opublikuj |
+-----------+------------------------------------------+---------------+
| Elementy  |                                          | Ustawienia    |
| Struktura |   prawdziwy wygląd strony (PageView)     | zaznaczonego  |
|           |   klik = zaznaczenie, złota ramka        | elementu      |
|           |   „+” między sekcjami = wstaw tutaj      |               |
+-----------+------------------------------------------+---------------+
```

1. **Lewy panel (zwijany):**
   - Zakładka „Elementy”: 7 obecnych bloków z kategoriami, wyszukiwarką, miniaturą i opisem. Element dodaje się kliknięciem albo przeciągnięciem na stronę.
   - Zakładka „Struktura”: drzewo sekcji z elementami w środku (nagłówek, tekst, zdjęcie, przyciski, karty). Kliknięcie zaznacza element na podglądzie. Kolejność zmieniasz przeciąganiem. Do tego duplikowanie, ukrywanie i usuwanie z potwierdzeniem.
2. **Środek:** strona w rzeczywistym wyglądzie (ten sam komponent co publicznie). Elementy podświetlają się po najechaniu, zaznaczasz je kliknięciem. Między sekcjami są przyciski „+ dodaj tutaj”. Podgląd można przełączyć na szerokość komputera, tabletu lub telefonu. Elementy wychodzące poza ekran dostają ostrzeżenie.
3. **Prawy panel (zależy od zaznaczenia):**
   - Tekst: treść.
   - Nagłówek / nadtytuł: tekst.
   - Zdjęcie: wymiana bez utraty reszty treści, opis alt, podpis, oznaczenie jako dekoracyjne, położenie i sposób wyświetlania.
   - Przycisk: etykieta i adres, sprawdzane tymi samymi regułami co dziś.
   - Karta lub kolumna: tytuł i opis.
   - Sekcja: rodzaj, układ, ukrycie, duplikowanie, usunięcie.
   - Strona: tytuł, wstęp, adres, SEO.
4. **Szkic oddzielony od publikacji:**
   - Zmiany zapisują się automatycznie co kilka sekund do szkicu. Odwiedzający go nie widzą.
   - „Opublikuj” (z potwierdzeniem) kopiuje szkic do wersji publicznej.
   - Wyjście bez publikacji zostawia stronę publiczną bez zmian. Po powrocie wczytuje się zapisany szkic.
   - Przy niezapisanych lub nieopublikowanych zmianach pojawia się ostrzeżenie.
5. **Cofnij / Ponów** w edytorze (także Ctrl+Z / Ctrl+Shift+Z).
6. **Historia wersji:** każda publikacja i każdy ręczny „Zapisz szkic” tworzy wersję. Możesz zobaczyć listę wersji, prosty podgląd różnic (dodane, usunięte i zmienione sekcje) i przywrócić wersję do szkicu. Nic nie zostaje nadpisane bez możliwości odzyskania.
7. **Telefon:** na wąskim ekranie panele boczne otwierają się jako wysuwane szuflady, a podgląd zajmuje cały ekran.
8. **Mapa zasięgu Buildera:** krótka tabela w edytorze pokazuje, co jest edytowalne wizualnie (strony CMS: treść i układ bloków). Pozostałe obszary są oznaczone „Nieobsługiwane w edycji wizualnej — działa normalnie”: strona główna, menu, stopka, moduły, Moje TNB, formularze, strony prawne. Każdy z wyjaśnieniem dlaczego.

## Czego wersja 1 celowo NIE robi (zgodnie z warunkami)

- Nie obejmuje modułów (Biblioteka, Podcast, Spotkania, płatności, zapisy) ani strony głównej, menu i stopki. To kolejne etapy.
- Nie dodaje ustawień kolorów i czcionek per element ani ustawień osobnych dla urządzeń. Bloki mają dziś jeden wygląd na wszystkich urządzeniach.
- Nie dodaje zapisanych własnych komponentów i szablonów ani zagnieżdżania sekcji w sekcjach. Zostanie to zaproponowane w etapie 40.2.
- Nie zmienia płatności, rejestracji, uprawnień, logo ani istniejących treści.

## Testy

Testy wyłącznie na nowej stronie testowej „test-builder” (szkic, niepubliczna). Sprawdzę wszystkie 15 kryteriów odbioru na komputerze i telefonie oraz to, że:
- strona publiczna zmienia się dopiero po „Opublikuj”,
- moderator i gość nie mają dostępu.

Strony „O TNB” i „Moja historia” nie zostaną zmienione. Raport: Test | Wynik | Uwagi.

## Kolejne etapy (propozycja)

- 40.2: zapisane komponenty i szablony, ukrywanie sekcji per urządzenie.
- 40.3: strona główna zbudowana z bloków, z istniejącymi listami (artykuły, społeczność) jako zablokowane bloki dynamiczne.
- 40.4: menu i stopka.
- 40.5: strony prawne.
- Później: teksty i komunikaty modułów. Tylko treść — bez logiki.

## Szczegóły techniczne

- Migracja w site_pages:
  - nowe kolumny `draft` (jsonb: title, intro, sections, seo_*) i `draft_updated_at`,
  - nowa tabela `site_page_versions` (page_id, snapshot jsonb, kind: draft|publish|restore, created_by, created_at) z GRANT, RLS tylko dla adminów i zapisem przez funkcje serwerowe po `assertAdmin` oraz `logEvent`.
- Nowe funkcje serwerowe w `pages.functions.ts`: `adminSaveDraft` (ta sama walidacja Zod co `adminSavePage`), `adminPublishDraft`, `adminListVersions`, `adminRestoreVersion`.
- Odczyt publiczny (`getPublicPage`) bez zmian: nadal tylko opublikowane kolumny.
- Istniejące opublikowane strony: szkic startuje jako kopia wersji publicznej, więc dane się nie zmieniają.
- Pole `hidden` w sekcji (opcjonalne, domyślnie false). Normalizacja zachowuje stare wiersze. PageView pomija ukryte sekcje publicznie, a w edytorze pokazuje je wyszarzone.
- PageView dostaje opcjonalne propsy `editable` (zaznaczanie, hover, data-atrybuty ścieżki elementu). Bez nich renderuje się identycznie jak dziś.
- Przeciąganie: `@dnd-kit` (lista sekcji i drzewo). Podgląd urządzeń: kontener o stałej szerokości 1280/820/390 px w trybie „container queries”. Jeśli breakpointy oparte na viewport tego nie oddadzą, podgląd przełączy się na iframe z tą samą trasą podglądu.
- Reguła architektoniczna zostanie zapisana w AGENTS.md: jeden Builder, a moduły podłączane przez rejestr „zakresu edytowalności”.
