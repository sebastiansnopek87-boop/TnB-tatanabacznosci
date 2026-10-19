import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HOME_FIELDS, HOME_ITEM_FIELDS, assetUrl, type Field } from "@/lib/home-content";
import { isSafeHref, type HomeKind, type PageItem, type PageSection } from "@/lib/pages";

// Inspector for home-page blocks: every field maps 1:1 to a key the public renderer reads.
type Patch = (p: Partial<PageSection>, key?: string) => void;
const selCls = "h-8 w-full border border-border bg-background px-2 text-xs";
const ITEM_LABEL: Record<string, string> = { title: "Tytuł", body: "Opis", href: "Adres (np. /biblioteka)", cta: "Przycisk — etykieta" };
const MODULE_NOTE: Partial<Record<HomeKind, string>> = {
  home_articles: "Artykuły pochodzą z modułu „Artykuły” (wyróżnione na stronie głównej). Tutaj zmieniasz tylko ich prezentację.",
  home_community: "Rozmowy pochodzą z modułu społeczności; niezalogowani widzą tylko publiczne wpisy.",
  home_quote_newsletter: "Formularz zapisu i zgody pozostają bez zmian — w edytorze nie wysyła danych.",
  home_quicknav: "Skróty do ukrytych modułów nie są pokazywane publicznie.",
};

function FieldInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const bad = /href$/i.test(f.key) && value && !isSafeHref(value);
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[0.65rem] uppercase tracking-wide text-muted-foreground">{f.label}</span>
      {f.options ? <select className={selCls} value={value} onChange={(e) => onChange(e.target.value)}>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : f.multiline ? <Textarea rows={4} value={value} maxLength={3000} onChange={(e) => onChange(e.target.value)} />
        : <Input value={value} maxLength={300} onChange={(e) => onChange(e.target.value)} className={bad ? "border-destructive" : ""} />}
      {(bad || f.hint) && <span className={`mt-1 block text-[0.65rem] ${bad ? "text-destructive" : "text-muted-foreground"}`}>{bad ? "Adres musi zaczynać się od /, https:// lub mailto:" : f.hint}</span>}
    </label>
  );
}

export function HomeInspector({ s, el, busy, urls, onPatch, onSelectEl, onUpload, onUploadItem }: {
  s: PageSection; el: string; busy: boolean; urls: Record<string, string>; onPatch: Patch; onSelectEl: (el: string) => void;
  onUpload: (f: File) => void; onUploadItem: (k: number, f: File) => void;
}) {
  const kind = s.kind as HomeKind;
  const fields = HOME_FIELDS[kind] ?? [];
  const list = HOME_ITEM_FIELDS[kind];
  const set = (key: string, v: string) => onPatch({ settings: { ...s.settings, [key]: v } }, `f:${key}`);
  const imgUrl = (v?: string | null) => (v ? assetUrl(v) ?? urls[v] : undefined);
  const hasSectionImage = kind === "home_hero" || kind === "home_quote_newsletter";

  if (el.startsWith("f:")) {
    const f = fields.find((x) => x.key === el.slice(2));
    if (f) return <><FieldInput f={f} value={s.settings?.[f.key] ?? ""} onChange={(v) => set(f.key, v)} /><Button size="sm" variant="ghost" onClick={() => onSelectEl("section")}>Wszystkie pola sekcji</Button></>;
  }
  const item = el.startsWith("item-") ? Number(el.slice(5)) : -1;
  if (list && item >= 0 && s.items[item]) {
    const it = s.items[item]!;
    const patchItem = (p: Partial<PageItem>, k: string) => onPatch({ items: s.items.map((x, j) => (j === item ? { ...x, ...p } : x)) }, `it${item}${k}`);
    return (
      <>
        <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-gold">{list.label} {item + 1}</p>
        {list.fields.map((k) => <FieldInput key={k} f={{ key: k, label: ITEM_LABEL[k] ?? k, multiline: k === "body" }} value={(it[k] as string) ?? ""} onChange={(v) => patchItem({ [k]: k === "href" ? v.trim() : v }, k)} />)}
        {list.image && <ImageBox url={imgUrl(it.image)} busy={busy} alt={it.alt ?? ""} onAlt={(v) => patchItem({ alt: v }, "alt")} onFile={(f) => onUploadItem(item, f)} />}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" disabled={item === 0} onClick={() => { const a = [...s.items]; [a[item - 1], a[item]] = [a[item]!, a[item - 1]!]; onPatch({ items: a }); onSelectEl(`item-${item - 1}`); }}>W lewo/górę</Button>
          <Button size="sm" variant="ghost" disabled={item === s.items.length - 1} onClick={() => { const a = [...s.items]; [a[item + 1], a[item]] = [a[item]!, a[item + 1]!]; onPatch({ items: a }); onSelectEl(`item-${item + 1}`); }}>W prawo/dół</Button>
          <Button size="sm" variant="ghost" onClick={() => { onPatch({ items: s.items.filter((_, j) => j !== item) }); onSelectEl("section"); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Usuń</Button>
        </div>
      </>
    );
  }
  return (
    <>
      {MODULE_NOTE[kind] && <p className="mb-3 border border-gold/40 p-2 text-[0.7rem] text-muted-foreground">{MODULE_NOTE[kind]}</p>}
      {fields.map((f) => <FieldInput key={f.key} f={f} value={s.settings?.[f.key] ?? ""} onChange={(v) => set(f.key, v)} />)}
      {hasSectionImage && (
        <>
          <ImageBox url={imgUrl(s.image) ?? imgUrl(kind === "home_hero" ? "asset:hero" : "asset:banner")} busy={busy} alt={s.imageAlt} onAlt={(v) => onPatch({ imageAlt: v }, "alt")} onFile={onUpload} />
          {s.image && <Button size="sm" variant="ghost" onClick={() => onPatch({ image: null })}>Przywróć zdjęcie domyślne</Button>}
        </>
      )}
      {list && (
        <div className="mb-3 space-y-1">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{list.label}i</p>
          {s.items.map((it, k) => <button key={k} onClick={() => onSelectEl(`item-${k}`)} className="block w-full border border-border/50 px-2 py-1 text-left text-xs hover:border-gold/60">{it.title || `(bez tytułu ${k + 1})`}</button>)}
          {s.items.length < list.max && <Button size="sm" variant="outline" onClick={() => { onPatch({ items: [...s.items, { title: "Nowy element", body: "", href: "/" }] }); onSelectEl(`item-${s.items.length}`); }}><Plus className="mr-1 h-3 w-3" />Dodaj</Button>}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!s.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} />Ukryj sekcję na stronie publicznej</label>
    </>
  );
}

function ImageBox({ url, busy, alt, onAlt, onFile }: { url: string | undefined; busy: boolean; alt: string; onAlt: (v: string) => void; onFile: (f: File) => void }) {
  return (
    <div className="mb-3 space-y-2 border border-border/50 p-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Zdjęcie</p>
      {url && <img src={url} alt="" className="max-h-32 border border-border/60" />}
      <label className="inline-block cursor-pointer border border-border px-3 py-1.5 text-xs hover:bg-muted/40">
        Zmień zdjęcie
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>
      <Input placeholder="Opis zdjęcia dla niewidomych (alt)" value={alt} maxLength={200} onChange={(e) => onAlt(e.target.value)} />
    </div>
  );
}
