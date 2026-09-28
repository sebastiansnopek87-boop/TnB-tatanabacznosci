/**
 * Site settings – single source of editable data (contact, social, footer,
 * contact page, legal pages). Shape mirrors a future `site_settings` table so
 * the admin panel can replace `getSiteSettings()` without touching components.
 * Empty values (null / "") are hidden in the UI — never put placeholder data here.
 */

export type SocialPlatform = "facebook" | "instagram" | "youtube" | "tiktok" | "linkedin" | "x" | "spotify";

export type NavLink = { id: string; label: string; href: string; order: number; visible: boolean };
export type SocialLink = { platform: SocialPlatform; label: string; url: string; order: number; visible: boolean };

export type LegalPage = {
  slug: "polityka-prywatnosci" | "regulamin" | "polityka-cookies";
  title: string;
  description: string;
  /** Approved content as plain paragraphs. Empty = page shows "wymaga uzupełnienia". */
  paragraphs: string[];
  approved: boolean;
};

export type SiteSettings = {
  organization: { name: string | null; legalName: string | null };
  contact: { email: string | null; phone: string | null; showInFooter: boolean };
  social: SocialLink[];
  footer: {
    brandDescription: string;
    aboutLink: { label: string; href: string; visible: boolean };
    columns: { id: string; title: string; order: number; visible: boolean; links: NavLink[] }[];
    contactColumnTitle: string;
    copyrightText: string;
  };
  contactPage: {
    eyebrow: string;
    title: string;
    intro: string;
    formTitle: string;
    contactDataTitle: string;
    successMessage: string;
    errorMessage: string;
  };
  legal: LegalPage[];
};

const SETTINGS: SiteSettings = {
  organization: { name: null, legalName: null },
  contact: { email: null, phone: null, showInFooter: true },
  social: [],
  footer: {
    brandDescription:
      "Przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Miejsce, w którym możesz coś zabrać dla siebie i zostawić coś od siebie.",
    aboutLink: { label: "O nas", href: "/#o-tnb", visible: true },
    columns: [
      {
        id: "odkrywaj",
        title: "Odkrywaj",
        order: 1,
        visible: true,
        links: [
          { id: "historia", label: "Moja historia", href: "/#o-tnb", order: 1, visible: true },
          { id: "biblioteka", label: "Biblioteka", href: "/#o-tnb", order: 2, visible: true },
          { id: "podcast", label: "Podcast", href: "/#o-tnb", order: 3, visible: true },
          { id: "spolecznosc", label: "Społeczność", href: "/#o-tnb", order: 4, visible: true },
          { id: "rozwoj", label: "Rozwój", href: "/#o-tnb", order: 5, visible: true },
          { id: "premium", label: "Materiały premium", href: "/#o-tnb", order: 6, visible: true },
        ],
      },
      {
        id: "informacje",
        title: "Informacje",
        order: 2,
        visible: true,
        links: [
          { id: "kontakt", label: "Kontakt", href: "/kontakt", order: 1, visible: true },
          { id: "prywatnosc", label: "Polityka prywatności", href: "/polityka-prywatnosci", order: 2, visible: true },
          { id: "regulamin", label: "Regulamin", href: "/regulamin", order: 3, visible: true },
          { id: "cookies", label: "Polityka cookies", href: "/polityka-cookies", order: 4, visible: true },
        ],
      },
    ],
    contactColumnTitle: "Bądźmy w kontakcie",
    copyrightText: "Wszelkie prawa zastrzeżone.",
  },
  contactPage: {
    eyebrow: "Kontakt",
    title: "Porozmawiajmy",
    intro:
      "Masz pytanie, chcesz podzielić się swoją historią albo po prostu porozmawiać? Napisz — każdą wiadomość czytamy osobiście.",
    formTitle: "Napisz wiadomość",
    contactDataTitle: "Dane kontaktowe",
    successMessage: "Dziękujemy! Wiadomość została przyjęta. Odpowiemy najszybciej, jak to możliwe.",
    errorMessage: "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.",
  },
  legal: [
    { slug: "polityka-prywatnosci", title: "Polityka prywatności", description: "Zasady przetwarzania danych osobowych w serwisie Tata Na Baczności.", paragraphs: [], approved: false },
    { slug: "regulamin", title: "Regulamin", description: "Regulamin korzystania z serwisu Tata Na Baczności.", paragraphs: [], approved: false },
    { slug: "polityka-cookies", title: "Polityka cookies", description: "Informacje o plikach cookies w serwisie Tata Na Baczności.", paragraphs: [], approved: false },
  ],
};

export function getSiteSettings(): SiteSettings {
  return SETTINGS;
}

export const byOrder = <T extends { order: number; visible: boolean }>(items: T[]) =>
  items.filter((i) => i.visible).sort((a, b) => a.order - b.order);

export const visibleSocial = (s: SiteSettings) => byOrder(s.social.filter((x) => x.url.trim() !== ""));

export function getLegalPage(slug: LegalPage["slug"]): LegalPage {
  return SETTINGS.legal.find((p) => p.slug === slug)!;
}
