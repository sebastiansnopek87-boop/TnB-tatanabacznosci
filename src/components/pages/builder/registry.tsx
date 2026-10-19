import { SECTION_KINDS, type PageDraft, type SectionKind } from "@/lib/pages";

// Builder registry: which blocks exist, where they may go, and what the builder covers platform-wide.
const T = ({ children }: { children: React.ReactNode }) => <span aria-hidden className="flex h-11 w-14 shrink-0 flex-col justify-center gap-1 border border-border/60 bg-background p-1.5">{children}</span>;
const L = ({ w = "100%", gold }: { w?: string; gold?: boolean }) => <span className={`block h-1 ${gold ? "bg-gold" : "bg-foreground/30"}`} style={{ width: w }} />;

export const CATEGORIES = ["Podstawowe", "Układ", "Akcje", "Strona główna"] as const;
export const BLOCKS: { kind: SectionKind; cat: (typeof CATEGORIES)[number]; desc: string; Thumb: () => React.JSX.Element }[] = [
  { kind: "home-nav", cat: "Układ", desc: "Edytowalne linki i przyciski nagłówka strony głównej.", Thumb: () => <T><L gold /><L /></T> },
  { kind: "cinematic", cat: "Układ", desc: "Filmowe otwarcie z osobnymi scenami, tekstem i przyciskami.", Thumb: () => <T><span className="grid grid-cols-5 gap-px">{[0,1,2,3,4].map(i => <span key={i} className="h-4 bg-gold/30" />)}</span><L gold /></T> },
  { kind: "value-strip", cat: "Układ", desc: "Pas osobnych wartości z wybieranymi ikonami.", Thumb: () => <T><L gold /><L w="80%" /></T> },
  { kind: "text", cat: "Podstawowe", desc: "Nagłówek, akapity i opcjonalne zdjęcie z boku.", Thumb: () => <T><L w="50%" gold /><L /><L w="80%" /></T> },
  { kind: "quote", cat: "Podstawowe", desc: "Wyróżniony cytat z autorem, opcjonalnie na tle zdjęcia.", Thumb: () => <T><L w="20%" gold /><L w="90%" /><L w="40%" gold /></T> },
  { kind: "image", cat: "Podstawowe", desc: "Zdjęcie na pełną szerokość, w kolumnie lub jako wyróżniony blok.", Thumb: () => <T><span className="block h-6 w-full bg-foreground/20" /><L w="60%" /></T> },
  { kind: "hero", cat: "Układ", desc: "Duży nagłówek otwierający stronę. Tylko na samej górze.", Thumb: () => <T><L w="40%" gold /><span className="block h-2 w-full bg-foreground/50" /><L w="70%" /></T> },
  { kind: "columns", cat: "Układ", desc: "Dwie kolumny z listami punktów — np. porównanie.", Thumb: () => <T><span className="flex gap-1"><span className="h-6 flex-1 border border-gold/70" /><span className="h-6 flex-1 border border-foreground/30" /></span></T> },
  { kind: "values", cat: "Układ", desc: "Siatka kart z numerem, nazwą i krótkim opisem.", Thumb: () => <T><span className="grid grid-cols-3 gap-0.5">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="h-2.5 bg-foreground/25" />)}</span></T> },
  { kind: "home-hero", cat: "Strona główna", desc: "Dotychczasowe otwarcie „Czuwaj” ze zdjęciem i prawą kolumną.", Thumb: () => <T><L w="40%" gold /><L w="70%" /></T> },
  { kind: "home-articles", cat: "Strona główna", desc: "Najnowsze artykuły (na żywo) z edytowalnym nagłówkiem.", Thumb: () => <T><L w="40%" gold /><L /></T> },
  { kind: "home-talks", cat: "Strona główna", desc: "Najnowsze rozmowy społeczności i zachęta do dołączenia.", Thumb: () => <T><L w="40%" gold /><L /></T> },
  { kind: "quick-nav", cat: "Strona główna", desc: "Pas skrótów z ikonami do modułów.", Thumb: () => <T><L gold /></T> },
  { kind: "pillars", cat: "Strona główna", desc: "Karty filarów i kafelki ze zdjęciami.", Thumb: () => <T><L w="60%" gold /><L /></T> },
  { kind: "quote-newsletter", cat: "Strona główna", desc: "Cytat na tle zdjęcia i formularz newslettera.", Thumb: () => <T><L w="80%" /><L w="40%" gold /></T> },
  { kind: "home-footer", cat: "Strona główna", desc: "Stopka tylko dla strony głównej (puste pola = Ustawienia).", Thumb: () => <T><L /><L w="50%" /></T> },
  { kind: "cta", cat: "Akcje", desc: "Ramka z zachętą i przyciskami (np. dołącz, napisz).", Thumb: () => <T><span className="flex h-7 flex-col items-center justify-center gap-1 border border-gold/60"><L w="60%" /><span className="block h-1.5 w-5 bg-gold" /></span></T> },
];

export const canInsert = (kind: SectionKind, at: number) => kind !== "hero" || at === 0;

export const COVERAGE: { area: string; ok: boolean; note: string }[] = [
  { area: "Strony CMS (O TNB, Moja historia, /strony/…)", ok: true, note: "Treść, kolejność, zdjęcia, przyciski, ukrywanie sekcji, szkic, wersje i publikacja." },
  { area: "Strona główna", ok: true, note: "Po „Wczytaj dotychczasowe sekcje” cała strona: otwarcie, artykuły, rozmowy, skróty, karty, cytat z newsletterem i stopka; podgląd niezalogowany/zalogowany. Listy artykułów i rozmów wczytują się na żywo." },
  { area: "Nagłówek i menu", ok: true, note: "Na stronie głównej przez sekcję „Nagłówek strony głównej” (tylko ta strona). Logo i slogan — Ustawienia (globalnie). Na pozostałych stronach bez zmian." },
  { area: "Stopka", ok: true, note: "Na stronie głównej przez „Stopka strony głównej”. Dane firmy, kontakt i media — Ustawienia (globalnie)." },
  { area: "Strony prawne", ok: true, note: "Treść i wersje w CMS; publikacja wymaga treści i osobnego zatwierdzenia dokumentu." },
  { area: "Artykuły", ok: false, note: "Te same bloki, edycja w „Artykuły” (formularz)." },
  { area: "Biblioteka, Podcast, Spotkania, Rozmowy 1:1", ok: false, note: "Treść w swoich modułach panelu; logika (płatności, zapisy, dostęp) nie jest edytowalna wizualnie." },
  { area: "Rozmowy społeczności, Moje TNB", ok: false, note: "Dane użytkowników i uprawnienia — tylko moderacja w panelu." },
  { area: "Formularze i komunikaty systemowe", ok: false, note: "Pola i walidacja w kodzie; treść e-maili w „Szablony wiadomości”." },
];

export function diffDrafts(from: PageDraft, to: PageDraft): string[] {
  const out: string[] = [];
  if (from.title !== to.title) out.push(`Tytuł: „${from.title}” → „${to.title}”`);
  if (from.intro !== to.intro) out.push("Zmieniony wstęp");
  if (from.slug !== to.slug) out.push(`Adres: ${from.slug} → ${to.slug}`);
  if (from.seo_title !== to.seo_title || from.seo_description !== to.seo_description) out.push("Zmienione ustawienia SEO");
  const a = new Map(from.sections.map((s, i) => [s.id, { s, i }]));
  const b = new Map(to.sections.map((s, i) => [s.id, { s, i }]));
  const name = (s: PageDraft["sections"][number]) => `${SECTION_KINDS[s.kind]}${s.heading ? ` „${s.heading}”` : ""}`;
  for (const [id, { s }] of b) if (!a.has(id)) out.push(`Dodano: ${name(s)}`);
  for (const [id, { s }] of a) if (!b.has(id)) out.push(`Usunięto: ${name(s)}`);
  for (const [id, { s, i }] of b) {
    const o = a.get(id); if (!o) continue;
    const { id: _a, ...x } = o.s; const { id: _b, ...y } = s;
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`Zmieniono: ${name(s)}`);
    else if (o.i !== i) out.push(`Przeniesiono: ${name(s)}`);
  }
  return out;
}

// Pre-publish check: visible sections whose missing content would leave an empty spot on the page.
export type EmptyIssue = { i: number; el: string; label: string };
export function findEmpty(sections: PageDraft["sections"]): EmptyIssue[] {
  const out: EmptyIssue[] = [];
  const t = (v?: string | null) => !!v && v.trim().length > 0;
  sections.forEach((s, i) => {
    if (s.hidden || s.optional) return;
    const where = `sekcja ${i + 1} (${SECTION_KINDS[s.kind]})`;
    const any = t(s.heading) || t(s.body) || t(s.eyebrow) || !!s.image || s.buttons.length > 0 || s.items.some((it) => t(it.title) || t(it.body));
    if (s.kind === "image" ? !s.image : s.kind === "quote" ? !t(s.body) : !any) { out.push({ i, el: "section", label: `Pusta sekcja — ${where}` }); return; }
    if (s.kind === "values" || s.kind === "columns") s.items.forEach((it, k) => { if (!t(it.title) && !t(it.body)) out.push({ i, el: `item-${k}`, label: `Pusta ${s.kind === "values" ? "karta" : "kolumna"} ${k + 1} — ${where}` }); });
    if (s.kind === "cta" && !t(s.heading) && !t(s.body)) out.push({ i, el: "section", label: `CTA bez nagłówka i tekstu — ${where}` });
    if (s.kind === "cta" && s.buttons.length === 0) out.push({ i, el: "section", label: `CTA bez przycisku — ${where}` });
    if ((s.kind === "hero" || s.kind === "text") && !t(s.heading) && !t(s.body)) out.push({ i, el: "section", label: `Brak nagłówka i tekstu — ${where}` });
  });
  return out;
}
