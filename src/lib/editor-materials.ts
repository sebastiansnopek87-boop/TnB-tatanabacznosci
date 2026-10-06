// Browser-safe shared model for AI assistant materials.
export type MaterialSection = { id: string; heading: string; body: string; refs: string[] };
export const CONTRIB = "TU POTRZEBNY JEST TWÓJ WKŁAD";
export const VERIFY = "WYMAGA WERYFIKACJI";

export const MATERIAL_STATUS: Record<string, string> = {
  idea: "Pomysł", to_create: "Do stworzenia", generating: "Generowanie", draft: "Wersja robocza", editing: "W edycji",
  review: "Do weryfikacji", ready: "Gotowe do publikacji", published: "Opublikowane", rejected: "Odrzucone", archived: "Archiwalne",
};

// Fixed rules sent with every material call and shown read-only in "Ustawienia agenta".
export const MATERIAL_RULES = [
  "Język: wyłącznie polski, naturalny, bez kalk z angielskiego.",
  "Charakter TNB: autentyczny, spokojny, dojrzały, męski i ciepły; bez moralizowania i marketingowego tonu.",
  "Styl: konkretnie, po ludzku, krótkie akapity, zwracanie się do ojca jak do partnera.",
  "Autentyczność: nie udawaj doświadczeń, których nie masz; nie pisz w pierwszej osobie jako Sebastian o przeżyciach, których nie podał.",
  "Zakaz wymyślania osobistych historii Sebastiana — w ich miejscu wstaw oznaczenie wkładu.",
  "Zakaz wymyślania źródeł, badań, statystyk, ekspertów i cytatów.",
  "Fakty tylko z zatwierdzonych źródeł; przy sekcji wskazuj, z których źródeł korzysta.",
  "Informacje spoza źródeł oznaczaj jako wymagające weryfikacji.",
];

// Text materials always become an ARTICLE draft; only audio scripts go to Głos TNB.
// The Library is never a hand-off target (it stays a read-only knowledge source).
export const handoffTarget = (format: string): "article" | "podcast" =>
  format === "podcast" || format === "scenariusz audio/wideo" ? "podcast" : "article";
// Article metadata proposed by the AI and edited by Sebastian before hand-off.
export type ArticleMeta = { lead?: string; meta_title?: string; meta_description?: string; slug?: string; category?: string; tags?: string[]; cta?: string; reflection_question?: string };
export const HANDOFF_LABEL = { article: "Artykuły", library: "Biblioteka TNB", podcast: "Głos TNB" } as const;
export const HANDOFF_PATH = { article: "/admin/artykuly", library: "/admin/biblioteka", podcast: "/admin/podcast" } as const;
