import before from "@/assets/cinematic-before.jpg";
import expecting from "@/assets/cinematic-expecting.jpg";
import duty from "@/assets/cinematic-duty.jpg";
import father from "@/assets/cinematic-father.jpg";
import after from "@/assets/cinematic-after.jpg";
import { newSection, type PageSection } from "./pages";
import { HOME_CTA_DEFAULTS } from "./home-cta";

export const CINEMATIC_ASSETS: Record<string, string> = {
  "cinematic-before": before, "cinematic-expecting": expecting, "cinematic-duty": duty,
  "cinematic-father": father, "cinematic-after": after,
};

export function newCinematicSection(): PageSection {
  return {
    ...newSection("home_cinematic"),
    settings: {
      ...HOME_CTA_DEFAULTS,
      line1: "RÓŻNE DROGI.", line2: "TEN SAM KIERUNEK.",
      body: "Tata Na Baczności to przestrzeń mężczyzn, którzy mierzą się z prawdziwym życiem — w służbie, w rodzinie, na starcie nowej drogi i po niej. Historie, rozmowy, doświadczenia i wsparcie ludzi, którzy naprawdę rozumieją, przez co przechodzisz.",
      ctaLabel: "DOŁĄCZ DO SPOŁECZNOŚCI", ctaHref: "/spolecznosc", secondaryLabel: "ZOBACZ, CZYM JEST TNB", secondaryHref: "/o-tnb",
      value1Title: "PRAWDZIWI LUDZIE", value1Body: "Historie z życia, nie z teorii.",
      value2Title: "ROZMOWY BEZ OCENY", value2Body: "Trudne tematy, które naprawdę mają znaczenie.",
      value3Title: "RÓŻNE PERSPEKTYWY", value3Body: "Wojsko, Policja, Straż, Służba Celna, Straż Graniczna i inni.",
      value4Title: "RODZINA TEŻ JEST WAŻNA", value4Body: "Bo siła zaczyna się w domu.",
      value5Title: "ROZWÓJ NA KAŻDYM ETAPIE", value5Body: "Niezależnie od tego, gdzie aktualnie jesteś.",
    },
    items: [
      { title: "Zanim założysz mundur", body: "Pytania. Obawy. Pierwsze decyzje. Nowy etap życia.", image: "asset:cinematic-before", alt: "Młody mężczyzna z plecakiem przed bramą jednostki" },
      { title: "Kiedy masz zostać ojcem", body: "Radość. Lęk. Odpowiedzialność. Czego nikt ci nie mówi.", image: "asset:cinematic-expecting", alt: "Przyszły ojciec trzymający ubranko niemowlęce" },
      { title: "Kiedy wszyscy na tobie polegają", body: "Służba. Presja. Rodzina. Równowaga, która nie zawsze jest możliwa.", image: "asset:cinematic-duty", alt: "Żołnierz nad jeziorem o zachodzie słońca" },
      { title: "Gdy jesteś ojcem", body: "Obecność. Relacje. Prawdziwe wyzwania. To, co zostaje.", image: "asset:cinematic-father", alt: "Ojciec obejmujący syna nad jeziorem" },
      { title: "Kiedy zdejmujesz mundur", body: "Nowa tożsamość. Doświadczenia, które zostają. Co dalej?", image: "asset:cinematic-after", alt: "Mężczyzna w cywilnym ubraniu w warsztacie" },
    ],
  };
}