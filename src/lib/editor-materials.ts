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

export const handoffTarget = (format: string): "article" | "library" | "podcast" =>
  format === "artykuł" ? "article" : format === "podcast" || format === "scenariusz audio/wideo" ? "podcast" : "library";
export const HANDOFF_LABEL = { article: "Artykuły", library: "Biblioteka TNB", podcast: "Głos TNB" } as const;
export const HANDOFF_PATH = { article: "/admin/artykuly", library: "/admin/biblioteka", podcast: "/admin/podcast" } as const;
