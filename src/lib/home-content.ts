import hero from "@/assets/hero-opt.jpg.asset.json";
import banner from "@/assets/banner-opt.jpg.asset.json";
import cardHistoria from "@/assets/card-historia.jpg.asset.json";
import cardBiblioteka from "@/assets/card-biblioteka.jpg.asset.json";
import cardPodcast from "@/assets/card-podcast.jpg.asset.json";
import tileSpolecznosc from "@/assets/tile-spolecznosc.jpg.asset.json";
import tileSpotkania from "@/assets/tile-spotkania.jpg.asset.json";
import tileTworczosc from "@/assets/tile-tworczosc.jpg.asset.json";
import { newSection, type HomeKind, type PageItem, type PageSection } from "./pages";
import { CINEMATIC_ASSETS, newCinematicSection } from "./cinematic-content";

// Built-in photos of the home page. Sections reference them as "asset:<name>" until an admin uploads a replacement.
export const HOME_ASSETS: Record<string, string> = {
  ...CINEMATIC_ASSETS,
  hero: hero.url, banner: banner.url, "card-historia": cardHistoria.url, "card-biblioteka": cardBiblioteka.url, "card-podcast": cardPodcast.url,
  "tile-spolecznosc": tileSpolecznosc.url, "tile-spotkania": tileSpotkania.url, "tile-tworczosc": tileTworczosc.url,
};
export const assetUrl = (v: string | null | undefined) => (v?.startsWith("asset:") ? HOME_ASSETS[v.slice(6)] : undefined);

export type Field = { key: string; label: string; multiline?: boolean; hint?: string; options?: [string, string][] };
const SPACING: Field = { key: "spacing", label: "Odstępy sekcji", options: [["", "Standardowe"], ["compact", "Mniejsze"], ["loose", "Większe"]] };
const FOCUS: Field = { key: "focus", label: "Kadrowanie zdjęcia", options: [["", "Środek"], ["top", "Góra"], ["bottom", "Dół"], ["left", "Lewa strona"], ["right", "Prawa strona"]] };
const GOLD = "Słowa w *gwiazdkach* są złote.";

// Field list per block: drives the inspector; the renderer reads the same keys.
export const HOME_FIELDS: Record<HomeKind, Field[]> = {
  home_cinematic: [
    { key: "line1", label: "Nagłówek — część jasna" }, { key: "line2", label: "Nagłówek — część miedziana" },
    { key: "body", label: "Główny opis", multiline: true },
    { key: "ctaLabel", label: "Pierwszy przycisk — tekst" }, { key: "ctaHref", label: "Pierwszy przycisk — adres" },
    { key: "secondaryLabel", label: "Drugi przycisk — tekst" }, { key: "secondaryHref", label: "Drugi przycisk — adres" },
    ...Array.from({ length: 5 }, (_, i): Field[] => [
      { key: `value${i + 1}Title`, label: `Wartość ${i + 1} — nagłówek` },
      { key: `value${i + 1}Body`, label: `Wartość ${i + 1} — opis`, multiline: true },
      { ...FOCUS, key: `scene${i + 1}Focus`, label: `Scena ${i + 1} — kadrowanie` },
    ]).flat(),
    { key: "sceneHeight", label: "Wysokość scen", options: [["", "Standardowa"], ["compact", "Niższa"], ["tall", "Wyższa"]] },
    { key: "contrast", label: "Przyciemnienie zdjęć", options: [["", "Standardowe"], ["soft", "Łagodniejsze"], ["deep", "Mocniejsze"]] },
    { key: "valuesVisible", label: "Pas wartości", options: [["", "Widoczny"], ["off", "Ukryty"]] }, SPACING,
  ],
  home_hero: [
    { key: "eyebrow", label: "Nadtytuł" }, { key: "line1", label: "Nagłówek — linia 1 (biała)" }, { key: "line2", label: "Nagłówek — linia 2 (złota)" }, { key: "line3", label: "Nagłówek — linia 3 (złota)" },
    { key: "body", label: "Opis", multiline: true }, { key: "ctaLabel", label: "Przycisk — etykieta", hint: "Pusta etykieta ukrywa przycisk." }, { key: "ctaHref", label: "Przycisk — adres" },
    { key: "asideTitle", label: "Prawa kolumna — nagłówek", hint: GOLD }, { key: "asideSub", label: "Prawa kolumna — podtytuł" },
    { key: "asidePoints", label: "Prawa kolumna — akapity", multiline: true, hint: `Jeden akapit w linii. ${GOLD}` }, { key: "quote", label: "Cytat" },
    { key: "asideNote", label: "Notka pod cytatem", multiline: true }, { key: "communityLead", label: "Zaproszenie — tekst" }, { key: "communityLabel", label: "Zaproszenie — link" }, { key: "communityHref", label: "Zaproszenie — adres" },
    FOCUS, SPACING,
  ],
  home_articles: [
    { key: "eyebrow", label: "Nadtytuł" }, { key: "heading", label: "Nagłówek" }, { key: "sub", label: "Opis", multiline: true }, { key: "empty", label: "Tekst, gdy brak artykułów" },
    { key: "count", label: "Liczba artykułów", options: [["", "Wszystkie wyróżnione"], ["3", "3"], ["6", "6"]] }, { key: "buttonLabel", label: "Przycisk — etykieta" }, SPACING,
  ],
  home_community: [
    { key: "eyebrow", label: "Nadtytuł" }, { key: "heading", label: "Nagłówek" }, { key: "sub", label: "Opis", multiline: true },
    { key: "count", label: "Liczba rozmów", options: [["3", "3"], ["6", "6"]] }, { key: "buttonLabel", label: "Przycisk — etykieta" },
    { key: "ctaText", label: "Ramka zaproszenia — tekst", multiline: true }, { key: "ctaGuestNote", label: "Ramka — dopisek dla niezalogowanych" }, { key: "ctaButton", label: "Ramka — przycisk" }, SPACING,
  ],
  home_quicknav: [SPACING],
  home_pillars: [SPACING],
  home_tiles: [SPACING],
  home_quote_newsletter: [
    { key: "quote", label: "Cytat", multiline: true, hint: "Każda linia to osobny wiersz." }, { key: "sign", label: "Podpis cytatu" },
    { key: "newsHeading", label: "Newsletter — nagłówek" }, { key: "newsBody", label: "Newsletter — opis", multiline: true }, FOCUS, SPACING,
  ],
};
// Which item fields each list block offers.
export const HOME_ITEM_FIELDS: Partial<Record<HomeKind, { label: string; fields: (keyof PageItem)[]; max: number; image?: boolean; fixed?: boolean }>> = {
  home_cinematic: { label: "Scena", fields: ["title", "body"], max: 5, image: true, fixed: true },
  home_quicknav: { label: "Skrót", fields: ["title", "body", "href"], max: 9 },
  home_pillars: { label: "Karta", fields: ["title", "body", "cta", "href"], max: 6, image: true },
  home_tiles: { label: "Kafelek", fields: ["title", "body", "href"], max: 6, image: true },
};

const sec = (kind: HomeKind, id: string, settings: Record<string, string>, extra: Partial<PageSection> = {}): PageSection =>
  ({ ...newSection("text"), kind, id, settings, ...extra });

// Exactly the content shown on the home page before CMS: used as fallback and as the first draft.
export function homeDefaultSections(): PageSection[] {
  return [
    sec("home_hero", "homehero", {
      eyebrow: "Doświadczenia · Ludzie · Rozmowy · Rozwój", line1: "Czuwaj", line2: "nad tym,", line3: "co naprawdę ważne.",
      body: "Tata Na Baczności to przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Miejsce, w którym możesz coś zabrać dla siebie i zostawić coś od siebie.",
      ctaLabel: "Poznaj TNB", ctaHref: "/o-tnb", asideTitle: "Nie musisz mieć *wszystkiego poukładanego*.", asideSub: "Wystarczy, że nie przestajesz szukać.",
      asidePoints: "Możesz być *silny* i mieć gorszy dzień.\nMożesz *kochać swoją rodzinę* i czasem nie wiedzieć, co zrobić.\nMożesz mieć za sobą wiele i wciąż *próbować zrozumieć siebie*.",
      quote: "„Nie musisz tu nikomu niczego udowadniać.”",
      asideNote: "To miejsce dla ludzi, którzy chcą żyć bardziej świadomie, być bliżej swoich bliskich i nie zgubić po drodze samych siebie.",
      communityLead: "Nie musisz być sam —", communityLabel: "dołącz do społeczności", communityHref: "/spolecznosc",
    }, { imageAlt: "Ojciec z synem patrzący na zachód słońca w górach" }),
    sec("home_articles", "homearticles", { eyebrow: "Teksty redakcyjne", heading: "Artykuły", sub: "Myśli, doświadczenia i historie, którymi chcę się z Wami podzielić.", empty: "Przygotowuję pierwsze artykuły. Zajrzyj tu wkrótce.", buttonLabel: "Zobacz wszystkie artykuły", count: "" }),
    sec("home_community", "homecommunity", {
      eyebrow: "Tworzone przez członków społeczności", heading: "Rozmowy społeczności", sub: "Tutaj każdy może zabrać głos. Dzielimy się doświadczeniem, pytamy i słuchamy.", count: "3", buttonLabel: "Przejdź do rozmów",
      ctaText: "Masz coś, czym chcesz się podzielić? Twoje doświadczenie może być ważne dla kogoś innego.", ctaGuestNote: "Publikowanie rozmów wymaga bezpłatnego konta TNB.", ctaButton: "Rozpocznij rozmowę",
    }),
    sec("home_quicknav", "homequicknav", {}, { items: [
      { title: "Biblioteka", body: "E-booki, dokumenty, nagrania, materiały do pracy", href: "/biblioteka" },
      { title: "Głos TNB", body: "Historie, rozmowy i głosy ludzi w drodze", href: "/podcast" },
      { title: "Rozmowy", body: "Rozmowy członków społeczności", href: "/spolecznosc" },
      { title: "Spotkania 1:1", body: "Rozmowa, mentoring, czas dla Ciebie", href: "/spotkania/rozmowa-1-1" },
      { title: "Artykuły", body: "Autorskie teksty o ojcostwie, służbie i wartościach", href: "/artykuly" },
      { title: "Premium w Bibliotece", body: "Płatne materiały Biblioteki TNB, które zostaną z Tobą na dłużej", href: "/materialy-premium" },
      { title: "Moje TNB", body: "Twój profil, postępy, zapisane treści", href: "/moje-tnb" },
    ] }),
    sec("home_pillars", "homepillars", {}, { items: [
      { title: "Moja historia", body: "Od trudnych początków, przez 18 lat służby, po rodzinę, życie po mundurze i wszystko to, co nauczyło mnie pokory, odpowiedzialności i wdzięczności.", cta: "Poznaj moją drogę", href: "/moja-historia", image: "asset:card-historia", alt: "Portret mężczyzny w ciepłym świetle" },
      { title: "Biblioteka TNB", body: "E-booki, zeszyty ćwiczeń, dokumenty, nagrania i materiały, które zostają na dłużej.", cta: "Przeglądaj materiały", href: "/biblioteka", image: "asset:card-biblioteka", alt: "Książki i kubek kawy w ciepłym świetle" },
      { title: "Głos TNB", body: "Rozmowy o życiu, wartościach, relacjach, wyzwaniach i powrotach. Prawdziwe historie, bez udawania.", cta: "Posłuchaj Głosu TNB", href: "/podcast", image: "asset:card-podcast", alt: "Mikrofon studyjny" },
    ] }),
    sec("home_tiles", "hometiles", {}, { items: [
      { title: "Rozmowy społeczności", body: "Miejsce, w którym możesz czytać, komentować, dzielić się doświadczeniami i być częścią czegoś większego.", href: "/spolecznosc", image: "asset:tile-spolecznosc", alt: "Ludzie przy ognisku" },
      { title: "Spotkania 1:1", body: "Czas na rozmowę.\nCzas dla Ciebie.", href: "/spotkania/rozmowa-1-1", image: "asset:tile-spotkania", alt: "Rozświetlona chata wieczorem" },
      { title: "Moja twórczość", body: "Muzyka, wiersze, teksty.\nInny wymiar tych samych doświadczeń.", href: "/biblioteka", image: "asset:tile-tworczosc", alt: "Kompas i mapa" },
    ] }),
    sec("home_quote_newsletter", "homequote", {
      quote: "Nie musisz być żołnierzem, żeby być człowiekiem z zasadami.\nNie musisz mieć za sobą wyjątkowej historii, żeby mieć coś wartościowego do przekazania.",
      sign: "Tata Na Baczności", newsHeading: "Bądź na bieżąco", newsBody: "Otrzymuj nowe materiały, zapowiedzi podcastów i ważne informacje.",
    }, { imageAlt: "Panorama gór o zachodzie słońca" }),
  ];
}

export const newHomeSection = (kind: HomeKind): PageSection => {
  if (kind === "home_cinematic") return newCinematicSection();
  const base = homeDefaultSections().find((s) => s.kind === kind);
  if (!base) throw new Error("Nieznany typ sekcji strony głównej.");
  return { ...structuredClone(base), id: newSection().id };
};

// A published home record is used only when it is a real home layout; anything else keeps the built-in page.
export const usableHome = (sections: unknown): sections is PageSection[] =>
  Array.isArray(sections) && sections.some((s: any) => typeof s?.kind === "string" && s.kind.startsWith("home_") && !s.hidden);

export const spacingClass = (v?: string) => (v === "compact" ? "[&>section]:!py-8 lg:[&>section]:!py-12" : v === "loose" ? "[&>section]:!py-24 lg:[&>section]:!py-36" : "");
export const focusClass = (v?: string) => ({ top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right" } as Record<string, string>)[v ?? ""] ?? "object-center";
