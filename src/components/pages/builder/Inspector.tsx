import { lazy, Suspense } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IMAGE_DISPLAY, SECTION_KINDS, isSafeHref, type ImageDisplay, type PageDraft, type PageSection, type SectionKind } from "@/lib/pages";

const TextEditor = lazy(() => import("./TextEditor").then(m => ({ default: m.TextEditor })));

// Right-hand panel: edits exactly the fields the selected element renders from.
type Patch = (p: Partial<PageSection>, key?: string) => void;
const NO_IMAGE: SectionKind[] = ["values", "columns", "cta"];

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="mb-3 block"><span className="mb-1 block text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>{children}{hint && <span className="mt-1 block text-[0.65rem] text-muted-foreground">{hint}</span>}</label>;
}
const sel = "h-8 w-full border border-border bg-background px-2 text-xs";

export function Inspector({ s, el, busy, imageUrl, onPatch, onSelectEl, onUpload }: {
  s: PageSection; el: string; busy: boolean; imageUrl: string | undefined; onPatch: Patch; onSelectEl: (el: string) => void; onUpload: (f: File) => void;
}) {
  const btn = el.startsWith("button-") ? Number(el.slice(7)) : -1;
  const item = el.startsWith("item-") ? Number(el.slice(5)) : -1;
  const text = (k: "eyebrow" | "heading" | "body" | "quoteAuthor" | "caption", label: string, _rows = 0) => (
    <Suspense fallback={<p className="text-xs text-muted-foreground">Wczytywanie edytora…</p>}><TextEditor key={`${s.id}:${k}`} label={label} value={s[k]} format={s.textFormats?.[k]} onChange={(plain, format) => { const formats = { ...s.textFormats }; if (format) formats[k] = format; else delete formats[k]; onPatch({ [k]: plain, textFormats: formats }, k); }} /></Suspense>
  );

  if (el === "eyebrow") return text("eyebrow", "Nadtytuł (mały złoty napis)");
  if (el === "heading") return text("heading", "Nagłówek");
  if (el === "body") return <>{text("body", s.kind === "quote" ? "Treść cytatu" : "Tekst — akapity oddzielaj pustą linią", 12)}</>;
  if (el === "quoteAuthor") return text("quoteAuthor", "Autor cytatu");
  if (el === "caption") return text("caption", "Podpis pod zdjęciem");
  if (el === "image") return <ImageFields s={s} busy={busy} imageUrl={imageUrl} onPatch={onPatch} onUpload={onUpload} />;
  if (btn >= 0 && s.buttons[btn]) {
    const b = s.buttons[btn];
    if (!b) return null;
    const set = (p: Partial<typeof b>, k: string) => onPatch({ buttons: s.buttons.map((x, j) => (j === btn ? { ...x, ...p } : x)) }, `btn${btn}${k}`);
    return (
      <>
        <F label="Etykieta przycisku"><Input value={b.label} maxLength={60} onChange={(e) => set({ label: e.target.value }, "l")} /></F>
        <F label="Adres" hint={b.href && !isSafeHref(b.href) ? "Adres musi zaczynać się od / (strona TNB), https:// lub mailto:" : "Np. /spolecznosc lub https://…"}>
          <Input value={b.href} maxLength={500} onChange={(e) => set({ href: e.target.value.trim() }, "h")} className={b.href && !isSafeHref(b.href) ? "border-destructive" : ""} />
        </F>
        <p className="mb-3 text-[0.65rem] text-muted-foreground">Pierwszy przycisk jest złoty, drugi obramowany, kolejne jako link.</p>
        <Button size="sm" variant="ghost" onClick={() => { onPatch({ buttons: s.buttons.filter((_, j) => j !== btn) }); onSelectEl("section"); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Usuń przycisk</Button>
      </>
    );
  }
  if (item >= 0 && s.items[item]) {
    const it = s.items[item];
    if (!it) return null;
    const set = (p: Partial<typeof it>, k: string) => onPatch({ items: s.items.map((x, j) => (j === item ? { ...x, ...p } : x)) }, `it${item}${k}`);
    return (
      <>
        {(["title", "body"] as const).map(field => <Suspense key={`${s.id}:${item}:${field}`} fallback={null}><TextEditor label={field === "title" ? "Tytuł" : "Treść"} value={it[field]} format={s.textFormats?.[`item-${item}-${field}`]} onChange={(plain, format) => { const formats = { ...s.textFormats }; const key = `item-${item}-${field}`; if (format) formats[key] = format; else delete formats[key]; onPatch({ items: s.items.map((x, j) => j === item ? { ...x, [field]: plain } : x), textFormats: formats }, key); }} /></Suspense>)}
        {s.kind === "values" && <Button size="sm" variant="ghost" onClick={() => { onPatch({ items: s.items.filter((_, j) => j !== item) }); onSelectEl("section"); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Usuń kartę</Button>}
      </>
    );
  }

  // Whole section
  return (
    <>
      <F label="Rodzaj sekcji">
        <select className={sel} value={s.kind} onChange={(e) => { const kind = e.target.value as SectionKind; onPatch({ kind, ...(kind === "columns" && s.items.length < 2 ? { items: [...s.items, { title: "", body: "" }, { title: "", body: "" }].slice(0, 2) } : {}) }); }}>
          {Object.entries(SECTION_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </F>
      {s.kind !== "quote" && text("eyebrow", "Nadtytuł")}
      {s.kind !== "quote" && text("heading", "Nagłówek")}
      {text("body", s.kind === "quote" ? "Treść cytatu" : "Tekst", 6)}
      {s.kind === "quote" && text("quoteAuthor", "Autor cytatu")}
      {(s.kind === "values" || s.kind === "columns") && (
        <div className="mb-3 space-y-1">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{s.kind === "values" ? "Karty" : "Kolumny"}</p>
          {s.items.map((it, k) => <button key={k} onClick={() => onSelectEl(`item-${k}`)} className="block w-full border border-border/50 px-2 py-1 text-left text-xs hover:border-gold/60">{it.title || `(bez tytułu ${k + 1})`}</button>)}
          {s.kind === "values" && s.items.length < 12 && <Button size="sm" variant="outline" onClick={() => { onPatch({ items: [...s.items, { title: "Nowa karta", body: "" }] }); onSelectEl(`item-${s.items.length}`); }}><Plus className="mr-1 h-3 w-3" />Karta</Button>}
        </div>
      )}
      {!NO_IMAGE.includes(s.kind) && <ImageFields s={s} busy={busy} imageUrl={imageUrl} onPatch={onPatch} onUpload={onUpload} />}
      <div className="mb-3 space-y-1">
        <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Przyciski</p>
        {s.buttons.map((b, k) => <button key={k} onClick={() => onSelectEl(`button-${k}`)} className="block w-full border border-border/50 px-2 py-1 text-left text-xs hover:border-gold/60">{b.label || "(bez etykiety)"} <span className="text-muted-foreground">{b.href}</span></button>)}
        {s.buttons.length < 4 && <Button size="sm" variant="outline" onClick={() => { onPatch({ buttons: [...s.buttons, { label: "Nowy przycisk", href: "/" }] }); onSelectEl(`button-${s.buttons.length}`); }}><Plus className="mr-1 h-3 w-3" />Przycisk</Button>}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!s.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} />Ukryj sekcję na stronie publicznej</label>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!s.optional} onChange={(e) => onPatch({ optional: e.target.checked })} />Opcjonalna treść (nie ostrzegaj o pustych polach przed publikacją)</label>
    </>
  );
}

function ImageFields({ s, busy, imageUrl, onPatch, onUpload }: { s: PageSection; busy: boolean; imageUrl: string | undefined; onPatch: Patch; onUpload: (f: File) => void }) {
  return (
    <div className="mb-3 space-y-2 border border-border/50 p-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Zdjęcie</p>
      {imageUrl && <img src={imageUrl} alt="" className="max-h-32 border border-border/60" />}
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer border border-border px-3 py-1.5 text-xs hover:bg-muted/40">
          {s.image ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </label>
        {s.image && <Button size="sm" variant="ghost" onClick={() => onPatch({ image: null })}>Usuń zdjęcie</Button>}
      </div>
      {s.image && <>
        {(s.kind === "hero" || s.kind === "text") && (
          <select aria-label="Położenie zdjęcia" className={sel} value={s.layout} onChange={(e) => onPatch({ layout: e.target.value as "left" | "right" })}>
            <option value="right">Zdjęcie po prawej</option><option value="left">Zdjęcie po lewej</option>
          </select>
        )}
        {s.kind === "image" && (
          <select aria-label="Sposób wyświetlania" className={sel} value={s.display ?? "full"} onChange={(e) => onPatch({ display: e.target.value as ImageDisplay })}>
            {Object.entries(IMAGE_DISPLAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!s.decorative} onChange={(e) => onPatch({ decorative: e.target.checked })} />Zdjęcie dekoracyjne (czytniki ekranu je pominą)</label>
        <Input placeholder="Opis zdjęcia dla niewidomych (alt)" value={s.imageAlt} disabled={!!s.decorative} maxLength={200} onChange={(e) => onPatch({ imageAlt: e.target.value }, "alt")} />
        <Input placeholder="Podpis pod zdjęciem" value={s.caption} maxLength={300} onChange={(e) => onPatch({ caption: e.target.value }, "caption")} />
      </>}
    </div>
  );
}

export function PagePanel({ d, system, onPatch }: { d: PageDraft; system: string | null; onPatch: (p: Partial<PageDraft>, key?: string) => void }) {
  return (
    <>
      <p className="mb-3 text-[0.7rem] text-muted-foreground">Kliknij element na podglądzie, żeby go edytować. Te ustawienia dotyczą całej strony.</p>
      <F label="Tytuł strony"><Input value={d.title} maxLength={200} onChange={(e) => onPatch({ title: e.target.value }, "title")} /></F>
      <F label="Adres" hint={system ? "Stały adres z menu — nie podlega zmianie." : "Zmiana adresu zadziała po publikacji."}>
        {system ? <Input value={system} disabled /> : <Input value={d.slug} maxLength={120} onChange={(e) => onPatch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }, "slug")} />}
      </F>
      <F label="Wstęp (pod tytułem, gdy strona nie zaczyna się od sekcji „Otwarcie strony”)"><Textarea rows={3} value={d.intro} maxLength={2000} onChange={(e) => onPatch({ intro: e.target.value }, "intro")} /></F>
      <F label={`Tytuł w wyszukiwarce (${d.seo_title.length}/70)`}><Input value={d.seo_title} maxLength={70} onChange={(e) => onPatch({ seo_title: e.target.value }, "seot")} /></F>
      <F label={`Opis w wyszukiwarce (${d.seo_description.length}/170)`}><Textarea rows={3} value={d.seo_description} maxLength={170} onChange={(e) => onPatch({ seo_description: e.target.value }, "seod")} /></F>
    </>
  );
}
