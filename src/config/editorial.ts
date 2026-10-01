// Editorial standard and templates for future Biblioteka TNB materials (static, versioned with the code).
export type Block = { heading: string; items: string[] };
export type Template = { id: string; name: string; purpose: string; sections: Block[]; skeleton: string };

export const EDITORIAL_VERSION = "1.1 (Etap 26.2)";

export const IDENTITY: Block = {
  heading: "Tożsamość redakcyjna TNB",
  items: [
    "TNB jest społecznością, a nie korporacyjnym portalem ani platformą coachingową.",
    "Sebastian dzieli się doświadczeniem, refleksją i perspektywą człowieka, który przeszedł własną drogę.",
    "Autor nie stawia się ponad czytelnikiem i nie przemawia z pozycji nieomylnego eksperta.",
    "Materiały pomagają w refleksji, rozmowie i podejmowaniu własnych decyzji.",
    "Czytelnik ma prawo do własnych wniosków. Nie narzucamy jednego sposobu życia.",
    "Język jest autentyczny, ludzki, konkretny i emocjonalnie wiarygodny.",
    "Unikamy korporacyjnego żargonu, pustych sloganów, sztucznego patosu i przesadnej motywacyjności.",
    "Nie tworzymy fikcyjnych historii osobistych, doświadczeń autora ani wypowiedzi innych osób.",
    "Nie przypisujemy autorowi kompetencji, których nie potwierdzono.",
    "Nie obiecujemy efektów terapeutycznych, zdrowotnych, finansowych ani życiowych.",
    "Metafory wojskowe są dozwolone, ale służba to jeden z elementów perspektywy autora, a nie jedyny temat TNB.",
  ],
};

export const LANGUAGE: Block = {
  heading: "Standard języka",
  items: [
    "Piszemy po polsku, naturalnie, bez zbędnych zapożyczeń (np. „informacja zwrotna”, nie „feedback”).",
    "Zwracamy się do czytelnika bezpośrednio („ty”), ale nie mentorsko — bez „musisz”, „powinieneś”, „zrób to teraz”.",
    "Akapity krótkie i średnie: zwykle 2–5 zdań. Jedna myśl na akapit.",
    "Nagłówki opisują rzeczywistą treść sekcji, a nie są hasłem reklamowym.",
    "Nie powtarzamy tej samej myśli innymi słowami. Nie wydłużamy tekstu sztucznie.",
    "Oszczędnie z wykrzyknikami, pytaniami retorycznymi i wielkimi literami (najwyżej jedno pytanie retoryczne na sekcję).",
    "Opinie oznaczamy jako opinie („moim zdaniem”, „z mojej perspektywy”), nie podajemy ich jako faktów.",
    "Twierdzenia wymagające potwierdzenia (liczby, badania, zalecenia zdrowotne) mają wiarygodne źródło z autorem, tytułem i rokiem.",
    "Osobista refleksja i informacja naukowa/ekspercka są wyraźnie rozdzielone — osobnym akapitem lub ramką „Co mówią badania”.",
    "Sceny ilustracyjne oznaczamy jako „Sytuacja ilustracyjna” i nie przypisujemy ich autorowi.",
  ],
};

export const VISUAL: Block = {
  heading: "Standard wizualny materiałów",
  items: [
    "Kolory przewodnie: grafit (tło/ramki), czerń (tekst przy druku na jasnym tle), złoto (akcenty, nagłówki, linie). Złota używamy oszczędnie — akcenty, nie całe bloki tekstu.",
    "Typografia: krój szeryfowy (jak w nagłówkach strony TNB) dla tytułów, czytelny krój bezszeryfowy dla treści; treść min. 11 pt w druku, 16 px na ekranie; interlinia ok. 1,5.",
    "Kontrast: tekst zawsze spełnia WCAG AA (min. 4,5:1). Złoty tekst tylko na ciemnym tle i w większym stopniu pisma.",
    "Dużo światła: szerokie marginesy (min. 2 cm w druku), odstęp przed nagłówkami większy niż po nich.",
    "Ozdobniki oszczędnie: cienka złota linia, ewentualnie logo w stopce. Bez teł z wzorami i ikon w każdym akapicie.",
    "Zdjęcia i ilustracje wspierają treść i mają opis alternatywny. Bez przypadkowych zdjęć stockowych ze stereotypowymi „idealnymi ojcami”.",
    "Spójna okładka: tytuł, podtytuł, autor, logo TNB, rodzaj materiału (e-book / poradnik / zeszyt / karty).",
    "Stopka na każdej stronie: „Tata na Baczności · tytuł materiału” oraz numer strony. Strona tytułowa bez numeru.",
    "Wersja do druku: jasne tło, ciemny tekst, złoto jako akcent — żeby nie zużywać tuszu. Wersja ekranowa może mieć ciemne tło.",
    "Czytelność na telefonie: PDF w jednym słupie, bez tabel szerszych niż strona, linki opisowe zamiast gołych adresów.",
  ],
};

export const WATERMARK: Block = {
  heading: "Znak wodny TNB (obowiązkowy dla PDF)",
  items: [
    "Dotyczy wszystkich plików PDF w Bibliotece TNB: e-booków, poradników, zeszytów ćwiczeń, kart pracy, materiałów edukacyjnych i innych.",
    "Używamy wyłącznie oryginalnego logo TATA NA BACZNOŚCI — bez zmiany kształtu, proporcji, kolorów, napisów i wewnętrznego tła. Logo nie jest generowane ponownie ani zastępowane tekstem.",
    "Dozwolone jest tylko usunięcie pustych narożników poza okręgiem logo (przezroczystość), żeby nie było czarnego kwadratu na jasnej stronie. Oryginalny plik pozostaje bez zmian.",
    "Strona tytułowa: logo w pełnych kolorach, wyśrodkowane nad tytułem, ok. 40 mm szerokości (dla A5; dla A4 ok. 55 mm).",
    "Pozostałe strony: małe logo (ok. 8 mm) w stopce, po prawej stronie, przed numerem strony, poniżej złotej linii — w tym samym miejscu i rozmiarze na każdej stronie.",
    "Logo nie leży na tekście, numerach stron, ilustracjach ani polach ćwiczeń. Nie stosujemy dużego logo w tle ani na środku strony.",
    "Logo jest osadzone w pliku PDF (nie jako odnośnik), w rozdzielczości wystarczającej do druku (min. 300 dpi w docelowym rozmiarze).",
    "Przed publikacją sprawdzamy wszystkie strony: obecność logo, brak kolizji ze stopką i treścią, wygląd na ekranie i w podglądzie wydruku.",
  ],
};


export const CHECKLIST: string[] = [
  "Zgodność z wartościami TNB: tekst nie poucza, nie obiecuje, zostawia czytelnikowi decyzję.",
  "Autentyczność: brak fikcyjnych doświadczeń autora i zmyślonych wypowiedzi; sceny ilustracyjne są oznaczone.",
  "Kompetencje: autorowi nie przypisano kwalifikacji, których nie potwierdzono.",
  "Logiczna struktura: elementy szablonu są kompletne, kolejność rozdziałów ma sens, nagłówki odpowiadają treści.",
  "Poprawność językowa: ortografia, interpunkcja, brak powtórzeń i sztucznego wydłużania.",
  "Brak nieuzasadnionych obietnic: zdrowotnych, terapeutycznych, finansowych, życiowych.",
  "Weryfikacja źródeł: każde twierdzenie faktograficzne ma sprawdzone źródło; linki działają.",
  "Użyteczność ćwiczeń: każde ma cel, instrukcję i miejsce na odpowiedź; wykonalne bez dodatkowych narzędzi.",
  "Prawa do zdjęć i materiałów: znana licencja lub własne zdjęcie; zgoda osób rozpoznawalnych.",
  "Czytelność na telefonie: plik sprawdzony na ekranie ok. 390 px.",
  "Znak wodny TNB: logo na stronie tytułowej i w stopce każdej strony, bez kolizji z treścią.",
  "Poprawność pliku końcowego: PDF otwiera się, ma numerację stron, spis treści działa, rozmiar rozsądny.",
  "Zgodność opisu, okładki i zawartości: tytuł, opis w Bibliotece, poziom dostępu i cena odpowiadają temu, co jest w pliku.",
  "Ograniczenia materiału: tam, gdzie to potrzebne, jest informacja, że materiał nie zastępuje pomocy specjalisty.",
];

export const TEMPLATES: Template[] = [
  {
    id: "ebook", name: "A. E-book refleksyjny",
    purpose: "Dłuższy tekst do spokojnego czytania i własnej refleksji.",
    sections: [{ heading: "Elementy", items: [
      "Strona tytułowa — tytuł, podtytuł, autor, logo TNB, rodzaj materiału.",
      "Krótkie wprowadzenie autora — po co powstał materiał i dla kogo (bez obietnic efektów).",
      "Spis treści.",
      "Rozdziały z logiczną strukturą — każdy z jedną główną myślą.",
      "Przykłady i sceny ilustracyjne — oznaczone, nieprzypisane autorowi.",
      "Pytania do osobistej refleksji — na końcu każdego rozdziału, 2–4 pytania.",
      "Podsumowanie.",
      "Zakończenie.",
      "Informacja o autorze — tylko potwierdzone fakty.",
      "Źródła — jeśli materiał zawiera twierdzenia wymagające udokumentowania.",
    ] }],
    skeleton: `# [Tytuł]
## [Podtytuł]
Sebastian Snopek · Tata na Baczności · E-book

## Zanim zaczniesz
[2–3 akapity: dlaczego ten temat, dla kogo, czego nie obiecujemy]

## Spis treści

## Rozdział 1. [Nagłówek opisujący treść]
[Treść]
> Sytuacja ilustracyjna: [scena — nie przypisana autorowi]
**Pytania do refleksji**
1. …
2. …

## Podsumowanie
## Zakończenie
## O autorze
[Tylko potwierdzone informacje]
## Źródła
- [Autor, tytuł, rok, link]`,
  },
  {
    id: "guide", name: "B. Poradnik praktyczny",
    purpose: "Konkretny problem i praktyczne wskazówki do zastosowania.",
    sections: [{ heading: "Elementy", items: [
      "Określenie problemu i celu.",
      "Wyjaśnienie kontekstu.",
      "Konkretne wskazówki — propozycje, nie nakazy.",
      "Przykłady zastosowania.",
      "Ćwiczenia lub zadania.",
      "Podsumowanie najważniejszych punktów.",
      "Informacja o ograniczeniach materiału.",
      "Źródła, jeśli są potrzebne.",
    ] }],
    skeleton: `# [Tytuł poradnika]
Tata na Baczności · Poradnik

## Problem i cel
[Jaki problem, co czytelnik może z tym zrobić]
## Kontekst
## Wskazówki
1. [Wskazówka] — [dlaczego może pomóc]
## Przykłady zastosowania
## Ćwiczenie
Cel: … · Instrukcja: … · Twoja odpowiedź: ________
## Najważniejsze punkty
## Ograniczenia
Ten materiał nie zastępuje porady specjalisty (psychologa, lekarza, prawnika).
## Źródła`,
  },
  {
    id: "workbook", name: "C. Zeszyt ćwiczeń",
    purpose: "Praca własna — do wypełnienia na ekranie lub po wydrukowaniu.",
    sections: [{ heading: "Elementy", items: [
      "Krótkie wprowadzenie.",
      "Jasny cel ćwiczenia.",
      "Instrukcja wykonania.",
      "Miejsce na własne odpowiedzi — linie w druku, pola formularza w PDF.",
      "Pytania pomocnicze.",
      "Podsumowanie własnych obserwacji.",
      "Opcjonalne miejsce na dalsze kroki.",
      "Format: A4 pionowo, jasne tło, duże pola odpowiedzi — działa na ekranie i po wydrukowaniu.",
    ] }],
    skeleton: `# [Tytuł zeszytu]
Tata na Baczności · Zeszyt ćwiczeń

## Wprowadzenie
## Ćwiczenie 1. [Nazwa]
**Cel:** …
**Jak to zrobić:** 1. … 2. …
**Twoje odpowiedzi:**
______________________________
______________________________
**Pytania pomocnicze:** …
## Moje obserwacje
______________________________
## Dalsze kroki (opcjonalnie)
______________________________`,
  },
  {
    id: "cards", name: "D. Karty rozmów i refleksji",
    purpose: "Pojedyncze karty do samodzielnej refleksji albo rozmowy z drugą osobą.",
    sections: [{ heading: "Elementy", items: [
      "Jedna myśl lub temat na kartę.",
      "Jedno główne pytanie.",
      "2–3 krótkie pytania pomocnicze.",
      "Oznaczenie: samodzielnie / we dwoje / oba sposoby.",
      "Brak oceniania odpowiedzi — żadnych „dobrych” i „złych” odpowiedzi ani punktacji.",
      "Format: karta ok. A6, 4 karty na stronie A4 z liniami cięcia.",
    ] }],
    skeleton: `KARTA [nr] · [Temat]
[Jedna myśl — 1 zdanie]

Pytanie główne:
[…?]

Pytania pomocnicze:
· …?
· …?

Sposób: samodzielnie / we dwoje
Tu nie ma dobrych ani złych odpowiedzi.`,
  },
];
