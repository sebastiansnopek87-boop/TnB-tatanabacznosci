import { type LegalPage } from "@/config/site-settings";
import { normalizeSections } from "./pages";

export const LEGAL_KEYS = ["regulamin", "polityka-prywatnosci", "polityka-cookies"] as const;
export type LegalKey = LegalPage["slug"];
export const isLegalKey = (key: string | null | undefined): key is LegalKey => LEGAL_KEYS.some((value) => value === key);
// A heading, image or hidden section is not document content.
export function hasLegalContent(sections: unknown): boolean {
  return normalizeSections(sections).some((s) => !s.hidden && (!!s.body?.trim() || s.items.some((i) => !!i.body?.trim())));
}
export function legalReady(key: LegalKey, page: { system_key: string | null; status?: string; legal_approved?: boolean; sections: unknown }): boolean {
  return page.system_key === key && page.status === "published" && page.legal_approved === true && hasLegalContent(page.sections);
}
export function assertLegalPublication(key: string | null | undefined, sections: unknown, confirmed = false) {
  if (!isLegalKey(key)) return;
  if (!hasLegalContent(sections)) throw new Error("Dokument prawny wymaga uzupełnienia treści.");
  if (!confirmed) throw new Error("Dokument prawny wymaga jawnego zatwierdzenia tej wersji w edytorze wizualnym.");
}
