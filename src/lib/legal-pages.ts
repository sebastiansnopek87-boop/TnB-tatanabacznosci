import { getLegalPage, type LegalPage } from "@/config/site-settings";
import { normalizeSections } from "./pages";

export const LEGAL_KEYS = ["regulamin", "polityka-prywatnosci", "polityka-cookies"] as const;
export type LegalKey = LegalPage["slug"];
export const isLegalKey = (key: string | null | undefined): key is LegalKey => LEGAL_KEYS.some((value) => value === key);
// A heading, image or hidden section is not document content.
export function hasLegalContent(sections: unknown): boolean {
  return normalizeSections(sections).some((s) => !s.hidden && (!!s.body?.trim() || s.items.some((i) => !!i.body?.trim())));
}
export function legalReady(key: LegalKey, sections: unknown): boolean {
  return getLegalPage(key).approved && hasLegalContent(sections);
}
export function assertLegalPublication(key: string | null | undefined, sections: unknown) {
  if (!isLegalKey(key)) return;
  if (!hasLegalContent(sections)) throw new Error("Dokument prawny wymaga uzupełnienia treści.");
  if (!getLegalPage(key).approved) throw new Error("Dokument prawny nie został zatwierdzony. Zatwierdzenie pozostaje osobnym etapem.");
}
