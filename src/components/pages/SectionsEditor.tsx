import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SECTION_KINDS, newSection, type PageSection, type SectionKind } from "@/lib/pages";

// The one content editor of the CMS — used by Strony and Artykuły, so both share the same blocks.
const KIND_LABEL = SECTION_KINDS;
const NO_IMAGE: SectionKind[] = ["values", "columns", "cta"];

type Props = {
  sections: PageSection[]; urls: Record<string, string>; busy: boolean;
  onChange: (fn: (s: PageSection[]) => PageSection[]) => void; onUpload: (i: number, f: File) => void;
  kinds?: SectionKind[];
};

export function SectionsEditor({ sections, urls, busy, onChange, onUpload, kinds }: Props) {
  const setSec = (i: number, patch: Partial<PageSection>) => onChange((a) => a.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => onChange((o) => { const a = [...o]; const j = i + dir; if (j < 0 || j >= a.length) return o; [a[i], a[j]] = [a[j]!, a[i]!]; return a; });
  const upload = onUpload;
  const allowed = kinds ?? (Object.keys(KIND_LABEL) as SectionKind[]);
  return (
      <div>
        <h2 className="font-display text-xl font-semibold uppercase">Sekcje</h2>
        <p className="text-xs text-muted-foreground">Akapity oddzielaj pustą linią. Kolejność zmieniasz strzałkami.</p>
        <div className="mt-3 space-y-4">
          {sections.map((s, i) => (
            <div key={s.id} className="space-y-3 border border-border/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gold">{i + 1}. {KIND_LABEL[s.kind]}</span>
                <select aria-label="Rodzaj sekcji" value={s.kind} onChange={(e) => { const kind = e.target.value as SectionKind; setSec(i, { kind, ...(kind === "columns" && s.items.length < 2 ? { items: [...s.items, { title: "", body: "" }, { title: "", body: "" }].slice(0, 2) } : {}) }); }} className="ml-auto h-8 border border-border bg-background px-2 text-xs">
                  {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <Button size="icon" variant="ghost" aria-label="W górę" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="W dół" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Usuń sekcję" onClick={() => confirm("Usunąć sekcję?") && onChange((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {["hero", "text", "values", "columns", "cta"].includes(s.kind) && <Input placeholder="Nadtytuł (mały złoty napis nad nagłówkiem, opcjonalnie)" value={s.eyebrow} onChange={(e) => setSec(i, { eyebrow: e.target.value })} maxLength={200} />}
              {s.kind !== "quote" && <Input placeholder="Nagłówek sekcji" value={s.heading} onChange={(e) => setSec(i, { heading: e.target.value })} maxLength={200} />}
              <Textarea rows={s.kind === "quote" ? 3 : 6} placeholder={s.kind === "quote" ? "Treść cytatu" : "Treść sekcji"} value={s.body} onChange={(e) => setSec(i, { body: e.target.value })} />
              {s.kind === "quote" && <Input placeholder="Autor cytatu" value={s.quoteAuthor} onChange={(e) => setSec(i, { quoteAuthor: e.target.value })} maxLength={120} />}
              {(s.kind === "values" || s.kind === "columns") && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{s.kind === "values" ? "Karty: nazwa i krótki opis." : "Kolumny: tytuł i punkty listy — każdy punkt w osobnej linii."}</p>
                  {s.items.map((it, k) => (
                    <div key={k} className="space-y-2 border border-border/40 p-3">
                      <div className="flex gap-2">
                        <Input placeholder={s.kind === "values" ? "Nazwa karty" : "Tytuł kolumny"} value={it.title} onChange={(e) => setSec(i, { items: s.items.map((x, j) => j === k ? { ...x, title: e.target.value } : x) })} maxLength={120} />
                        {s.kind === "values" && <Button size="icon" variant="ghost" aria-label="Usuń kartę" onClick={() => setSec(i, { items: s.items.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      <Textarea rows={s.kind === "values" ? 2 : 5} placeholder={s.kind === "values" ? "Opis" : "Punkty listy, każdy w nowej linii"} value={it.body} onChange={(e) => setSec(i, { items: s.items.map((x, j) => j === k ? { ...x, body: e.target.value } : x) })} />
                    </div>
                  ))}
                  {s.kind === "values" && s.items.length < 12 && <Button size="sm" variant="outline" onClick={() => setSec(i, { items: [...s.items, { title: "", body: "" }] })}><Plus className="mr-1 h-3 w-3" />Karta</Button>}
                </div>
              )}
              {!NO_IMAGE.includes(s.kind) && (
                <div className="space-y-2">
                  {s.image && urls[s.image] && <img src={urls[s.image]} alt="" className="max-h-40 border border-border/60" />}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer border border-border px-3 py-1.5 text-xs hover:bg-muted/40">
                      {s.image ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, f); e.target.value = ""; }} />
                    </label>
                    {s.image && <Button size="sm" variant="ghost" onClick={() => setSec(i, { image: null })}>Usuń zdjęcie</Button>}
                    {s.image && (s.kind === "hero" || s.kind === "text") && (
                      <select aria-label="Położenie zdjęcia" value={s.layout} onChange={(e) => setSec(i, { layout: e.target.value as "left" | "right" })} className="h-8 border border-border bg-background px-2 text-xs">
                        <option value="right">Zdjęcie po prawej</option><option value="left">Zdjęcie po lewej</option>
                      </select>
                    )}
                  </div>
                  {s.image && <>
                    <Input placeholder="Opis zdjęcia dla niewidomych (alt)" value={s.imageAlt} onChange={(e) => setSec(i, { imageAlt: e.target.value })} maxLength={200} />
                    <Input placeholder="Podpis pod zdjęciem" value={s.caption} onChange={(e) => setSec(i, { caption: e.target.value })} maxLength={300} />
                  </>}
                </div>
              )}
              <div className="space-y-2">
                {s.buttons.map((b, bi) => (
                  <div key={bi} className="flex flex-wrap gap-2">
                    <Input className="flex-1" placeholder="Etykieta przycisku" value={b.label} onChange={(e) => setSec(i, { buttons: s.buttons.map((x, k) => k === bi ? { ...x, label: e.target.value } : x) })} maxLength={60} />
                    <Input className="flex-1" placeholder="/spolecznosc lub https://…" value={b.href} onChange={(e) => setSec(i, { buttons: s.buttons.map((x, k) => k === bi ? { ...x, href: e.target.value.trim() } : x) })} maxLength={500} />
                    <Button size="icon" variant="ghost" aria-label="Usuń przycisk" onClick={() => setSec(i, { buttons: s.buttons.filter((_, k) => k !== bi) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {s.buttons.length < 4 && <Button size="sm" variant="outline" onClick={() => setSec(i, { buttons: [...s.buttons, { label: "", href: "" }] })}><Plus className="mr-1 h-3 w-3" />Przycisk</Button>}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {allowed.map((k) => (
              <Button key={k} variant="outline" size="sm" onClick={() => onChange((a) => [...a, newSection(k)])}><Plus className="mr-1 h-3 w-3" />{KIND_LABEL[k]}</Button>
            ))}
          </div>
        </div>
      </div>
  );
}
