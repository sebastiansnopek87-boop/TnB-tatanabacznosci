// Browser-safe shared model for AI assistant materials.
export type MaterialSection = { id: string; heading: string; body: string; refs: string[] };
// Legacy markers: older drafts may still contain them; new drafts never do (notes go to meta.notes).
export const CONTRIB = "TU POTRZEBNY JEST TWÓJ WKŁAD";
export const VERIFY = "WYMAGA WERYFIKACJI";

// Raw DB statuses kept for history/compatibility.
export const MATERIAL_STATUS: Record<string, string> = {
  idea: "Pomysł", to_create: "Do stworzenia", generating: "Generowanie", draft: "Wersja robocza", editing: "W edycji",
  review: "Do weryfikacji", ready: "Gotowe do publikacji", published: "Opublikowane", rejected: "Odrzucone", archived: "Archiwalne",
};

// The simplified workflow the UI shows: NOWY → TWORZENIE → DO PRZEGLĄDU → DO POPRAWY → GOTOWY → PRZEKAZANY → OPUBLIKOWANY.
export function stageOf(m: { status: string; handoff_id?: string | null }): { key: string; label: string } {
  if (m.status === "published") return { key: "published", label: "Opublikowany" };
  if (m.status === "rejected") return { key: "rejected", label: "Odrzucony" };
  if (m.status === "archived") return { key: "archived", label: "Archiwalny" };
  if (m.handoff_id) return { key: "handed", label: "Przekazany do Artykułów" };
  if (m.status === "ready") return { key: "ready", label: "Gotowy" };
  if (m.status === "generating") return { key: "creating", label: "Tworzenie" };
  if (m.status === "editing") return { key: "fix", label: "Do poprawy" };
  if (m.status === "draft" || m.status === "review") return { key: "review", label: "Do przeglądu" };
  return { key: "new", label: "Nowy" };
}

// Fixed rules sent with every material call and shown read-only in "Ustawienia agenta".
export const MATERIAL_RULES = [
  "Język: wyłącznie polski, naturalny, bez kalk z angielskiego.",
  "Charakter TNB: autentyczny, spokojny, dojrzały, męski i ciepły; bez moralizowania i marketingowego tonu.",
  "Styl: konkretnie, po ludzku, krótkie akapity, zwracanie się do ojca jak do partnera.",
  "Autentyczność: nie udawaj doświadczeń, których nie masz; nie pisz w pierwszej osobie jako Sebastian o przeżyciach, których nie podał.",
  "Zakaz wymyślania osobistych historii Sebastiana — gdy byłyby potrzebne, napisz tekst bez nich i dodaj uwagę redakcyjną.",
  "Zakaz wymyślania źródeł, badań, statystyk, ekspertów i cytatów.",
  "Fakty tylko z zatwierdzonych źródeł; przy sekcji wskazuj, z których źródeł korzysta.",
  "Treść artykułu jest kompletna: bez placeholderów, instrukcji dla autora i pustych miejsc. Wątpliwości trafiają wyłącznie do „Uwag redakcyjnych”.",
];

export type MaterialImage = {
  id: string; placement: "cover" | "inline"; after_section_id: string | null; description: string; alt: string; why: string;
  file: string | null; status: "planned" | "proposed" | "accepted"; prompt: string; ai: true;
};
export type SourceUse = { ref: string; id: string; table: string; title: string; kind: string; url: string | null; status: string; total: number; chars: number; usage: "full" | "summary" | "skipped"; excerpt: string };
export const USAGE_LABEL = { full: "pełna treść", summary: "streszczenie (całość przeczytana przez AI)", skipped: "pominięte — poza limitem" } as const;

// Text materials always become an ARTICLE draft; only audio scripts go to Głos TNB.
// The Library is never a hand-off target (it stays a read-only knowledge source).
export const handoffTarget = (format: string): "article" | "podcast" =>
  format === "podcast" || format === "scenariusz audio/wideo" ? "podcast" : "article";
// Article metadata proposed by the AI and edited by Sebastian before hand-off.
export type ArticleMeta = {
  lead?: string; meta_title?: string; meta_description?: string; slug?: string; category?: string; tags?: string[]; cta?: string; reflection_question?: string;
  notes?: string[]; images?: MaterialImage[]; usage?: { input: number; output: number; calls: number; images: number };
};
export const HANDOFF_LABEL = { article: "Artykuły", library: "Biblioteka TNB", podcast: "Głos TNB" } as const;
export const HANDOFF_PATH = { article: "/admin/artykuly", library: "/admin/biblioteka", podcast: "/admin/podcast" } as const;
