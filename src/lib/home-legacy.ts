import { newSection, type LegacyHomeKind, type PageSection } from "./pages";

// Exact content of the home page sections that used to live only in code. Used as the
// fallback for the public page and as the starting point when the builder imports them.
// "*text*" marks gold accent words (rendered by <Accent>).
const make = (kind: LegacyHomeKind, id: string, p: Partial<PageSection>): PageSection => ({ ...newSection(kind), id, ...p });

export function legacyHomeSections(): PageSection[] {
  return [
    make("home-hero", "lhero", {
      eyebrow: "Doświadczenia · Ludzie · Rozmowy · Rozwój", heading: "Czuwaj", caption: "nad tym,\nco naprawdę ważne.",
      body: "Tata Na Baczności to przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Miejsce, w którym możesz coś zabrać dla siebie i zostawić coś od siebie.",
      imageAlt: "Ojciec z synem patrzący na zachód słońca w górach", quoteAuthor: "Nie musisz być sam —",
      buttons: [{ label: "Poznaj TNB", href: "/o-tnb", icon: "arrow" }, { label: "dołącz do społeczności", href: "/spolecznosc", variant: "link" }],
      items: [
        { title: "Nie musisz mieć *wszystkiego poukładanego*.", body: "Wystarczy, że nie przestajesz szukać." },
        { title: "", body: "Możesz być *silny* i mieć gorszy dzień.\n\nMożesz *kochać swoją rodzinę* i czasem nie wiedzieć, co zrobić.\n\nMożesz mieć za sobą wiele i wciąż *próbować zrozumieć siebie*." },
        { title: "„Nie musisz tu nikomu niczego udowadniać.”", body: "To miejsce dla ludzi, którzy chcą żyć bardziej świadomie, być bliżej swoich bliskich i nie zgubić po drodze samych siebie." },
      ],
    }),
    make("home-articles", "larts", {
      eyebrow: "Teksty redakcyjne", heading: "Artykuły", body: "Myśli, doświadczenia i historie, którymi chcę się z Wami podzielić.",
      caption: "Przygotowuję pierwsze artykuły. Zajrzyj tu wkrótce.",
      buttons: [{ label: "Zobacz wszystkie artykuły", href: "/artykuly", icon: "arrow" }],
    }),
    make("home-talks", "ltalks", {
      eyebrow: "Tworzone przez członków społeczności", heading: "Rozmowy społeczności", body: "Tutaj każdy może zabrać głos. Dzielimy się doświadczeniem, pytamy i słuchamy.",
      buttons: [{ label: "Przejdź do rozmów", href: "/spolecznosc", icon: "arrow" }, { label: "Rozpocznij rozmowę", href: "/spolecznosc#new-post" }],
      items: [{ title: "Masz coś, czym chcesz się podzielić? Twoje doświadczenie może być ważne dla kogoś innego.", body: "Publikowanie rozmów wymaga bezpłatnego konta TNB." }],
    }),
    make("quick-nav", "lnav", {
      items: [
        { icon: "book", title: "Biblioteka", body: "E-booki, dokumenty, nagrania, materiały do pracy", href: "/biblioteka" },
        { icon: "mic", title: "Głos TNB", body: "Historie, rozmowy i głosy ludzi w drodze", href: "/podcast" },
        { icon: "users", title: "Rozmowy", body: "Rozmowy członków społeczności", href: "/spolecznosc" },
        { icon: "calendar", title: "Spotkania 1:1", body: "Rozmowa, mentoring, czas dla Ciebie", href: "/spotkania/rozmowa-1-1" },
        { icon: "compass", title: "Artykuły", body: "Autorskie teksty o ojcostwie, służbie i wartościach", href: "/artykuly" },
        { icon: "bag", title: "Premium w Bibliotece", body: "Płatne materiały Biblioteki TNB, które zostaną z Tobą na dłużej", href: "/materialy-premium" },
        { icon: "user", title: "Moje TNB", body: "Twój profil, postępy, zapisane treści", href: "/moje-tnb" },
      ],
    }),
    make("pillars", "lpill", {
      items: [
        { variant: "card", title: "Moja historia", body: "Od trudnych początków, przez 18 lat służby, po rodzinę, życie po mundurze i wszystko to, co nauczyło mnie pokory, odpowiedzialności i wdzięczności.", cta: "Poznaj moją drogę", href: "/moja-historia", asset: "historia", imageAlt: "Portret mężczyzny w ciepłym świetle" },
        { variant: "card", title: "Biblioteka TNB", body: "E-booki, zeszyty ćwiczeń, dokumenty, nagrania i materiały, które zostają na dłużej.", cta: "Przeglądaj materiały", href: "/biblioteka", asset: "biblioteka", imageAlt: "Książki i kubek kawy w ciepłym świetle" },
        { variant: "card", title: "Głos TNB", body: "Rozmowy o życiu, wartościach, relacjach, wyzwaniach i powrotach. Prawdziwe historie, bez udawania.", cta: "Posłuchaj Głosu TNB", href: "/podcast", asset: "podcast", imageAlt: "Mikrofon studyjny" },
        { variant: "tile", title: "Rozmowy społeczności", body: "Miejsce, w którym możesz czytać, komentować, dzielić się doświadczeniami i być częścią czegoś większego.", href: "/spolecznosc", asset: "spolecznosc", imageAlt: "Ludzie przy ognisku" },
        { variant: "tile", title: "Spotkania 1:1", body: "Czas na rozmowę.\nCzas dla Ciebie.", href: "/spotkania/rozmowa-1-1", asset: "spotkania", imageAlt: "Rozświetlona chata wieczorem" },
        { variant: "tile", title: "Moja twórczość", body: "Muzyka, wiersze, teksty.\nInny wymiar tych samych doświadczeń.", href: "/biblioteka", asset: "tworczosc", imageAlt: "Kompas i mapa" },
      ],
    }),
    make("quote-newsletter", "lquote", {
      body: "Nie musisz być żołnierzem, żeby być człowiekiem z zasadami.\nNie musisz mieć za sobą wyjątkowej historii, żeby mieć coś wartościowego do przekazania.",
      quoteAuthor: "Tata Na Baczności", imageAlt: "Panorama gór o zachodzie słońca",
      heading: "Bądź na bieżąco", caption: "Otrzymuj nowe materiały, zapowiedzi podcastów i ważne informacje.",
    }),
    // Empty texts/columns = take the global footer from Ustawienia (unchanged behaviour).
    make("home-footer", "lfoot", { optional: true }),
  ];
}

export const legacySection = (kind: LegacyHomeKind): PageSection => legacyHomeSections().find((s) => s.kind === kind)!;
