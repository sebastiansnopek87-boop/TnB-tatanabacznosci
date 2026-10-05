import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errMsg } from "@/components/admin/format";
import { PageSections } from "@/components/pages/PageView";
import { normalizeSections, type PageSection } from "@/lib/pages";
import {
  adminCreateTemplate, adminDeleteTemplate, adminDuplicateTemplate, adminListTemplates, adminTemplateImageUrls, adminUpdateTemplate, type BuilderTemplate,
} from "@/lib/templates.functions";

export const TEMPLATE_CATEGORIES = ["Otwarcia", "Treść", "Wartości", "Cytaty", "Zdjęcia", "Wezwania do działania", "Inne"];
export const SCOPE_LABEL = { element: "Element", section: "Sekcja", sections: "Kilka sekcji" } as const;

// Keeps only the chosen element of a section (same kind, same settings), so the template is a real builder section.
export function elementOnly(s: PageSection, el: string): PageSection {
  const base: PageSection = { ...structuredClone(s), eyebrow: "", heading: "", body: "", image: null, imageAlt: "", caption: "", quoteAuthor: "", buttons: [], items: [] };
  const m = /^(item|button)-(\d+)$/.exec(el);
  if (m) { const k = Number(m[2]); return m[1] === "item" ? { ...base, items: s.items[k] ? [structuredClone(s.items[k]!)] : [] } : { ...base, buttons: s.buttons[k] ? [{ ...s.buttons[k]! }] : [] }; }
  if (el === "image") return { ...base, image: s.image, imageAlt: s.imageAlt, caption: s.caption };
  if (el in base) return { ...base, [el]: (s as any)[el] };
  return structuredClone(s);
}

/** Real-render miniature: the public PageView scaled down, never a drawn mock-up. */
export function TemplateRender({ t, urls, width, scale, maxH }: { t: BuilderTemplate; urls: Record<string, string>; width: number; scale: number; maxH?: number }) {
  const inner = width / scale;
  return (
    <div className="relative overflow-hidden bg-background" style={{ width, maxHeight: maxH }} aria-hidden>
      <div style={{ width: inner, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <PageSections sections={normalizeSections(t.sections).map((s) => ({ ...s, hidden: false }))} imageSrc={(f) => urls[`${t.id}/${f}`]} />
      </div>
    </div>
  );
}

export function useTemplates() {
  const listFn = useServerFn(adminListTemplates); const urlsFn = useServerFn(adminTemplateImageUrls);
  const [list, setList] = useState<BuilderTemplate[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const reload = async () => {
    try {
      const l = await listFn(); setList(l);
      const files = l.flatMap((t) => (t.sections ?? []).map((s) => s.image).filter(Boolean).map((n) => ({ t: t.id, n: n as string }))).filter((f) => !urls[`${f.t}/${f.n}`]);
      if (files.length) setUrls({ ...urls, ...(await urlsFn({ data: { files } })) });
    } catch (e) { toast.error(errMsg(e)); setList([]); }
  };
  useEffect(() => { reload(); }, []);
  return { list, urls, reload };
}

export function TemplatesPanel({ tpl, placingId, onPlace, onDragStart, onDragEnd }: {
  tpl: ReturnType<typeof useTemplates>; placingId: string | null;
  onPlace: (t: BuilderTemplate) => void; onDragStart: (t: BuilderTemplate) => void; onDragEnd: () => void;
}) {
  const upd = useServerFn(adminUpdateTemplate); const dup = useServerFn(adminDuplicateTemplate); const del = useServerFn(adminDeleteTemplate);
  const [q, setQ] = useState(""); const [view, setView] = useState<BuilderTemplate | null>(null); const [edit, setEdit] = useState<BuilderTemplate | null>(null);
  const list = (tpl.list ?? []).filter((t) => !q || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
  async function run(fn: () => Promise<unknown>, ok: string) { try { await fn(); toast.success(ok); await tpl.reload(); } catch (e) { toast.error(errMsg(e)); } }

  return (
    <div className="mt-6" data-testid="my-templates">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">Moje szablony</p>
      <p className="mt-1 text-[0.68rem] leading-snug text-muted-foreground">Każde wstawienie tworzy niezależną kopię. Zmiana lub usunięcie szablonu nie zmienia stron, na których go użyto.</p>
      {(tpl.list?.length ?? 0) > 4 && <div className="relative mt-2"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-8 pl-7 text-xs" placeholder="Szukaj szablonu" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      {!tpl.list && <p className="mt-2 text-xs text-muted-foreground">Wczytywanie…</p>}
      {tpl.list?.length === 0 && <p className="mt-2 border border-dashed border-border/60 p-2 text-[0.68rem] text-muted-foreground">Brak szablonów. Zaznacz element lub sekcję na stronie i kliknij „Zapisz jako szablon” w prawym panelu.</p>}
      <div className="mt-2 space-y-2">
        {list.map((t) => (
          <div key={t.id} data-template={t.name} className={`border p-2 ${placingId === t.id ? "border-gold" : "border-border/60"}`}>
            <div draggable onDragStart={(e) => { onDragStart(t); e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", `tpl:${t.id}`); }} onDragEnd={onDragEnd} className="cursor-grab border border-border/40">
              <TemplateRender t={t} urls={tpl.urls} width={244} scale={0.2} maxH={110} />
            </div>
            <p className="mt-1.5 text-xs font-medium">{t.name}</p>
            <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{t.category} · {SCOPE_LABEL[t.scope]}</p>
            {t.description && <p className="text-[0.68rem] leading-snug text-muted-foreground">{t.description}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onPlace(t)}><Plus className="mr-1 h-3 w-3" />Dodaj</Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Podgląd szablonu" title="Podgląd" onClick={() => setView(t)}><Eye className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edytuj nazwę i opis" title="Edytuj nazwę i opis" onClick={() => setEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplikuj szablon" title="Duplikuj szablon" onClick={() => { const n = prompt("Nazwa duplikatu:", `${t.name} (kopia)`); if (n?.trim()) run(() => dup({ data: { id: t.id, name: n.trim() } }), "Zduplikowano szablon."); }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Usuń szablon" title="Usuń" onClick={() => confirm(`Usunąć szablon „${t.name}”? Strony, na których go użyto, zostaną bez zmian.`) && run(() => del({ data: { id: t.id } }), "Usunięto szablon.")}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      {view && (
        <Modal title={`Podgląd: ${view.name}`} onClose={() => setView(null)}>
          <p className="mb-2 text-xs text-muted-foreground">Rzeczywisty wygląd zapisanych elementów (pomniejszony).</p>
          <div className="max-h-[65vh] overflow-auto border border-border/60"><TemplateRender t={view} urls={tpl.urls} width={640} scale={0.5} /></div>
          <div className="mt-3 flex gap-2"><Button onClick={() => { onPlace(view); setView(null); }}>Dodaj na stronę</Button><Button variant="outline" onClick={() => setView(null)}>Zamknij</Button></div>
        </Modal>
      )}
      {edit && <MetaDialog title="Edytuj szablon" initial={edit} onClose={() => setEdit(null)} onSubmit={(m) => run(() => upd({ data: { id: edit.id, ...m } }), "Zapisano zmiany szablonu.").then(() => setEdit(null))} />}
    </div>
  );
}

export function SaveTemplateDialog({ pageId, sections, sel, onClose, onSaved }: { pageId: string; sections: PageSection[]; sel: { i: number; el: string }; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(adminCreateTemplate);
  const isEl = sel.el !== "section";
  const [scope, setScope] = useState<"element" | "section" | "sections">(isEl ? "element" : "section");
  const [to, setTo] = useState(Math.min(sel.i + 1, sections.length - 1));
  const s = sections[sel.i]!;
  const picked = scope === "element" ? [elementOnly(s, sel.el)] : scope === "section" ? [s] : sections.slice(sel.i, Math.max(to, sel.i) + 1);
  return (
    <MetaDialog title="Zapisz jako szablon" initial={{ name: s.heading ? `${s.heading}` : "", description: "", category: "Inne" }} onClose={onClose}
      extra={<div className="space-y-2 text-xs">
        <p className="uppercase tracking-wide text-muted-foreground">Co zapisać</p>
        {isEl && <label className="flex items-center gap-2"><input type="radio" checked={scope === "element"} onChange={() => setScope("element")} />Tylko zaznaczony element</label>}
        <label className="flex items-center gap-2"><input type="radio" checked={scope === "section"} onChange={() => setScope("section")} />Całą sekcję {sel.i + 1}</label>
        {sections.length > sel.i + 1 && <label className="flex flex-wrap items-center gap-2"><input type="radio" checked={scope === "sections"} onChange={() => setScope("sections")} />Sekcje od {sel.i + 1} do
          <select className="border border-border bg-background px-1" value={to} onChange={(e) => { setTo(Number(e.target.value)); setScope("sections"); }}>{sections.map((_, k) => k > sel.i && <option key={k} value={k}>{k + 1}</option>)}</select></label>}
        <p className="text-muted-foreground">Zapisuje się układ, teksty, zdjęcia, ustawienia i przyciski — bez żadnych danych użytkowników.</p>
      </div>}
      onSubmit={async (m) => { try { await create({ data: { ...m, pageId, scope, sections: picked } }); toast.success("Zapisano szablon w „Moje szablony”."); onSaved(); onClose(); } catch (e) { toast.error(errMsg(e)); } }} />
  );
}

function MetaDialog({ title, initial, extra, onClose, onSubmit }: { title: string; initial: { name: string; description: string; category: string }; extra?: React.ReactNode; onClose: () => void; onSubmit: (m: { name: string; description: string; category: string }) => Promise<unknown> }) {
  const [m, setM] = useState(initial); const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!m.name.trim()) return toast.error("Podaj nazwę szablonu."); setBusy(true); await onSubmit(m); setBusy(false); }}>
        <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Nazwa</span><Input aria-label="Nazwa szablonu" value={m.name} maxLength={120} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="np. Sekcja wartości — TNB" /></label>
        <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Opis (opcjonalnie)</span><Textarea aria-label="Opis szablonu" rows={2} value={m.description} maxLength={500} onChange={(e) => setM({ ...m, description: e.target.value })} /></label>
        <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Kategoria</span>
          <select aria-label="Kategoria szablonu" className="w-full border border-border bg-background p-2" value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>{TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        {extra}
        <div className="flex gap-2"><Button type="submit" disabled={busy}>Zapisz</Button><Button type="button" variant="outline" onClick={onClose}>Anuluj</Button></div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-border/60 bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold uppercase">{title}</h2><button aria-label="Zamknij" onClick={onClose}><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
