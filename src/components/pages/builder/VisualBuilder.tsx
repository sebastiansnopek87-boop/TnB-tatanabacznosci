import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, History, Info, Layers, LayoutGrid, Monitor, PanelLeft, PanelRight,
  Plus, Redo2, Search, Smartphone, Tablet, Trash2, Undo2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/components/admin/format";
import { PageView, type Sel } from "@/components/pages/PageView";
import {
  adminCreatePageUpload, adminGetPage, adminListVersions, adminPageImageUrls, adminPublishDraft, adminRestoreVersion, adminSaveDraft,
} from "@/lib/pages.functions";
import { SECTION_KINDS, SYSTEM_PAGES, newSection, normalizeSections, pagePath, type PageDraft, type PageSection, type PageVersion, type SectionKind } from "@/lib/pages";
import { Frame } from "./Frame";
import { Inspector, PagePanel } from "./Inspector";
import { BLOCKS, CATEGORIES, COVERAGE, canInsert, diffDrafts } from "./registry";

type Device = "desktop" | "tablet" | "phone";
const WIDTH: Record<Device, number | null> = { desktop: null, tablet: 820, phone: 390 };
let dragKind: SectionKind | null = null; // native DnD across the preview iframe (same JS realm)

const pick = (p: any): PageDraft => ({ slug: p.slug, title: p.title, intro: p.intro, sections: normalizeSections(p.sections), seo_title: p.seo_title ?? "", seo_description: p.seo_description ?? "" });
const same = (a: PageDraft, b: PageDraft) => JSON.stringify(a) === JSON.stringify(b);

export function VisualBuilder({ id, onClose, onFormView }: { id: string; onClose: () => void; onFormView: () => void }) {
  const getFn = useServerFn(adminGetPage); const saveFn = useServerFn(adminSaveDraft); const pubFn = useServerFn(adminPublishDraft);
  const verFn = useServerFn(adminListVersions); const restoreFn = useServerFn(adminRestoreVersion);
  const upFn = useServerFn(adminCreatePageUpload); const urlsFn = useServerFn(adminPageImageUrls);

  const [meta, setMeta] = useState<{ system_key: string | null; status: string; live: PageDraft } | null>(null);
  const [d, setD] = useState<PageDraft | null>(null);
  const [past, setPast] = useState<PageDraft[]>([]); const [future, setFuture] = useState<PageDraft[]>([]);
  const last = useRef({ key: "", t: 0 });
  const [sel, setSel] = useState<Sel | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [left, setLeft] = useState<"elements" | "structure" | null>("elements");
  const [rightOpen, setRightOpen] = useState(true);
  const [q, setQ] = useState("");
  const [placing, setPlacing] = useState<SectionKind | null>(null);
  const [saveState, setSaveState] = useState<{ dirty: boolean; at: string | null; err: string | null; busy: boolean }>({ dirty: false, at: null, err: null, busy: false });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [overflow, setOverflow] = useState<number[]>([]);
  const [modal, setModal] = useState<null | "history" | "coverage" | "publish">(null);
  const [versions, setVersions] = useState<PageVersion[] | null>(null);
  const [preview, setPreview] = useState<PageVersion | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;
    getFn({ data: { id } }).then((p) => {
      if (!live) return;
      const pub = pick(p);
      setMeta({ system_key: p.system_key, status: p.status, live: pub });
      setD(p.draft ? { ...pub, ...pick({ ...pub, ...p.draft }) } : pub);
      setSaveState((s) => ({ ...s, at: p.draft_updated_at }));
      if (typeof window !== "undefined" && window.innerWidth < 1024) { setLeft(null); setRightOpen(false); }
    }).catch((e) => { toast.error(errMsg(e)); onClose(); });
    return () => { live = false; };
  }, [id]);

  const names = (d?.sections ?? []).map((s) => s.image).filter(Boolean) as string[];
  useEffect(() => {
    const missing = names.filter((n) => !urls[n]);
    if (missing.length) urlsFn({ data: { id, names: missing } }).then((u) => setUrls((o) => ({ ...o, ...u }))).catch(() => {});
  }, [names.join(",")]);

  // Every edit goes through change(): undo history (typing coalesced per field) + autosave flag.
  const change = useCallback((fn: (o: PageDraft) => PageDraft, key = Math.random().toString()) => {
    setD((o) => {
      if (!o) return o;
      const n = fn(o);
      const now = Date.now();
      if (!(last.current.key === key && now - last.current.t < 1200)) { setPast((p) => [...p.slice(-80), o]); setFuture([]); }
      last.current = { key, t: now };
      return n;
    });
    setSaveState((s) => ({ ...s, dirty: true }));
  }, []);
  const setSections = (fn: (s: PageSection[]) => PageSection[], key?: string) => change((o) => ({ ...o, sections: fn(o.sections) }), key);
  const undo = () => { if (!past.length || !d) return; setFuture((f) => [d, ...f]); setD(past[past.length - 1]!); setPast((p) => p.slice(0, -1)); last.current.key = ""; setSaveState((s) => ({ ...s, dirty: true })); };
  const redo = () => { if (!future.length || !d) return; setPast((p) => [...p, d]); setD(future[0]!); setFuture((f) => f.slice(1)); last.current.key = ""; setSaveState((s) => ({ ...s, dirty: true })); };
  const undoRef = useRef({ undo, redo }); undoRef.current = { undo, redo };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || t.closest("input,textarea,select")) return;
      e.preventDefault(); e.shiftKey ? undoRef.current.redo() : undoRef.current.undo();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const save = useCallback(async (version: boolean) => {
    if (!d) return false;
    setSaveState((s) => ({ ...s, busy: true }));
    try {
      const r = await saveFn({ data: { id, draft: d, version } });
      setSaveState({ dirty: false, at: r.savedAt, err: null, busy: false });
      if (version) toast.success("Zapisano wersję roboczą. Strona publiczna bez zmian.");
      return true;
    } catch (e) { setSaveState((s) => ({ ...s, err: errMsg(e), busy: false })); if (version) toast.error(errMsg(e)); return false; }
  }, [d, id]);
  // Autosave a few seconds after the last edit.
  useEffect(() => { if (!saveState.dirty) return; const t = setTimeout(() => save(false), 2500); return () => clearTimeout(t); }, [d, saveState.dirty]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saveState.dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [saveState.dirty]);

  async function exit(to: "list" | "form") {
    if (saveState.dirty && !(await save(false)) && !confirm("Nie udało się zapisać ostatnich zmian. Wyjść mimo to?")) return;
    if (d && meta && !same(d, meta.live)) toast.message("Szkic zapisany — strona publiczna pozostaje bez zmian, dopóki nie klikniesz „Opublikuj”.");
    to === "list" ? onClose() : onFormView();
  }
  async function publish() {
    if (saveState.dirty && !(await save(false))) return;
    setSaveState((s) => ({ ...s, busy: true }));
    try {
      await pubFn({ data: { id } });
      setMeta((m) => m && d ? { ...m, status: "published", live: d } : m);
      toast.success("Opublikowano. Zmiany są widoczne na stronie publicznej.");
      setModal(null);
    } catch (e) { toast.error(errMsg(e)); } finally { setSaveState((s) => ({ ...s, busy: false })); }
  }
  async function openHistory() {
    setModal("history"); setVersions(null); setPreview(null);
    try { setVersions(await verFn({ data: { id } })); } catch (e) { toast.error(errMsg(e)); }
  }
  async function restore(v: PageVersion) {
    if (!confirm("Przywrócić tę wersję do szkicu? Obecny szkic zostanie zapisany w historii, strona publiczna się nie zmieni.")) return;
    if (d) await saveFn({ data: { id, draft: d, version: true } }).catch(() => {});
    try {
      const r = await restoreFn({ data: { id, versionId: v.id } });
      if (d) setPast((p) => [...p, d]);
      setD({ ...d!, ...r.draft, sections: normalizeSections(r.draft.sections) }); setSel(null); setModal(null);
      setSaveState((s) => ({ ...s, dirty: false, at: new Date().toISOString() }));
      toast.success("Przywrócono wersję do szkicu.");
    } catch (e) { toast.error(errMsg(e)); }
  }

  async function upload(i: number, file: File) {
    setSaveState((s) => ({ ...s, busy: true }));
    try {
      const { path, token, name } = await upFn({ data: { id, type: file.type, size: file.size } });
      const { error } = await supabase.storage.from("page-images").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Nie udało się wgrać zdjęcia.");
      setUrls((o) => ({ ...o, [name]: URL.createObjectURL(file) }));
      setSections((a) => a.map((s, j) => (j === i ? { ...s, image: name } : s)));
      toast.message("Zdjęcie wymienione. Reszta treści sekcji została bez zmian.");
    } catch (e) { toast.error(errMsg(e)); } finally { setSaveState((s) => ({ ...s, busy: false })); }
  }

  const insert = (at: number, kind: SectionKind) => {
    if (!canInsert(kind, at)) { toast.error("Otwarcie strony można wstawić tylko na samej górze."); return; }
    setSections((a) => [...a.slice(0, at), newSection(kind), ...a.slice(at)]);
    setSel({ i: at, el: "section" }); setPlacing(null); if (window.innerWidth >= 1024) setRightOpen(true);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || !d || to >= d.sections.length || from === to) return;
    setSections((o) => { const a = [...o]; const [x] = a.splice(from, 1); a.splice(to, 0, x!); return a; });
    setSel((s) => (s && s.i === from ? { ...s, i: to } : s));
  };
  const duplicate = (i: number) => { setSections((a) => [...a.slice(0, i + 1), { ...structuredClone(a[i]!), id: newSection().id }, ...a.slice(i + 1)]); setSel({ i: i + 1, el: "section" }); };
  const remove = (i: number) => { if (!confirm("Usunąć tę sekcję? Możesz to cofnąć przyciskiem „Cofnij”.")) return; setSections((a) => a.filter((_, j) => j !== i)); setSel(null); };
  const toggleHidden = (i: number) => setSections((a) => a.map((s, j) => (j === i ? { ...s, hidden: !s.hidden } : s)));

  const zone = (at: number) => {
    const active = placing ?? null;
    const ok = active ? canInsert(active, at) : true;
    return (
      <div data-zone="" className={`group relative flex items-center justify-center transition-all ${active ? "h-14" : "h-3 hover:h-10"}`}
        onDragOver={(e) => { if (dragKind && canInsert(dragKind, at)) { e.preventDefault(); e.currentTarget.dataset.over = "1"; } }}
        onDragLeave={(e) => { delete e.currentTarget.dataset.over; }}
        onDrop={(e) => { e.preventDefault(); delete e.currentTarget.dataset.over; if (dragKind) insert(at, dragKind); dragKind = null; }}>
        <button type="button" onClick={() => (active ? ok && insert(at, active) : setLeft("elements"))}
          className={`z-10 border px-3 py-1 text-[0.65rem] uppercase tracking-[0.14em] ${active ? (ok ? "border-gold bg-gold text-primary-foreground" : "cursor-not-allowed border-border bg-card text-muted-foreground") : "border-gold/60 bg-background text-gold opacity-0 group-hover:opacity-100"}`}>
          {active ? (ok ? `Wstaw tutaj: ${SECTION_KINDS[active]}` : "Tu nie można wstawić") : "+ Dodaj element"}
        </button>
        <span aria-hidden className={`absolute inset-x-0 top-1/2 h-px ${active && ok ? "bg-gold" : "bg-gold/30 opacity-0 group-hover:opacity-100"}`} />
      </div>
    );
  };

  if (!d || !meta) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-sm text-muted-foreground">Wczytywanie edytora…</div>;
  const unpublished = !same(d, meta.live) || meta.status !== "published";
  const system = meta.system_key ? SYSTEM_PAGES[meta.system_key] : null;
  const blocks = BLOCKS.filter((b) => !q || (SECTION_KINDS[b.kind] + b.desc).toLowerCase().includes(q.toLowerCase()));
  const selSection = sel ? d.sections[sel.i] : undefined;
  const timeStr = saveState.at ? new Date(saveState.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/60 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => exit("list")}>← Strony</Button>
        <Button size="icon" variant="ghost" aria-label="Panel elementów" onClick={() => setLeft((l) => (l ? null : "elements"))}><PanelLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{d.title || "(bez tytułu)"}</p>
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {saveState.busy ? "Zapisywanie…" : saveState.err ? <span className="text-destructive">Błąd zapisu: {saveState.err}</span> : saveState.dirty ? "Niezapisane zmiany…" : timeStr ? `Szkic zapisany ${timeStr}` : "Brak zmian"}
            {unpublished && <span className="ml-2 text-gold">· nieopublikowane zmiany</span>}
          </p>
        </div>
        <div className="mx-auto flex border border-border/60">
          {([["desktop", Monitor, "Komputer"], ["tablet", Tablet, "Tablet"], ["phone", Smartphone, "Telefon"]] as const).map(([k, I, l]) => (
            <button key={k} aria-label={l} title={l} onClick={() => setDevice(k)} className={`px-2.5 py-1.5 ${device === k ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><I className="h-4 w-4" /></button>
          ))}
        </div>
        <Button size="icon" variant="ghost" aria-label="Cofnij" title="Cofnij (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Ponów" title="Ponów (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Historia wersji" title="Historia wersji" onClick={openHistory}><History className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Zasięg edytora" title="Co można edytować wizualnie" onClick={() => setModal("coverage")}><Info className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => exit("form")}>Widok formularza</Button>
        <Button size="sm" variant="outline" disabled={saveState.busy} onClick={() => save(true)}>Zapisz szkic</Button>
        <Button size="sm" disabled={saveState.busy} onClick={() => setModal("publish")}>Opublikuj</Button>
        <Button size="icon" variant="ghost" aria-label="Panel ustawień" onClick={() => setRightOpen((r) => !r)}><PanelRight className="h-4 w-4" /></Button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Left panel */}
        {left && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-[290px] max-w-[85vw] flex-col border-r border-border/60 bg-card lg:static">
            <div className="flex border-b border-border/60">
              {([["elements", LayoutGrid, "Elementy"], ["structure", Layers, "Struktura"]] as const).map(([k, I, l]) => (
                <button key={k} onClick={() => setLeft(k)} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-wide ${left === k ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}><I className="h-3.5 w-3.5" />{l}</button>
              ))}
              <button aria-label="Zwiń panel" className="px-2 text-muted-foreground lg:hidden" onClick={() => setLeft(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {left === "elements" ? (
                <>
                  <div className="relative"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-8 pl-7 text-xs" placeholder="Szukaj elementu" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                  <p className="mt-2 text-[0.7rem] leading-snug text-muted-foreground">Przeciągnij element na stronę albo kliknij go, a potem wskaż miejsce na podglądzie.</p>
                  {placing && <div className="mt-2 flex items-center justify-between border border-gold/60 p-2 text-xs text-gold">Wskaż miejsce: {SECTION_KINDS[placing]}<button onClick={() => setPlacing(null)} aria-label="Anuluj"><X className="h-3.5 w-3.5" /></button></div>}
                  {CATEGORIES.map((c) => {
                    const list = blocks.filter((b) => b.cat === c);
                    if (!list.length) return null;
                    return (
                      <div key={c} className="mt-4">
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{c}</p>
                        <div className="mt-2 space-y-2">
                          {list.map((b) => (
                            <button key={b.kind} draggable onDragStart={(e) => { dragKind = b.kind; e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", b.kind); }} onDragEnd={() => { dragKind = null; }}
                              onClick={() => { setPlacing(b.kind); if (window.innerWidth < 1024) setLeft(null); }}
                              className={`flex w-full gap-3 border p-2 text-left hover:border-gold/60 ${placing === b.kind ? "border-gold" : "border-border/60"}`}>
                              <b.Thumb />
                              <span className="min-w-0"><span className="block text-xs font-medium">{SECTION_KINDS[b.kind]}</span><span className="block text-[0.68rem] leading-snug text-muted-foreground">{b.desc}</span></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-5 border border-dashed border-border/60 p-2 text-[0.68rem] text-muted-foreground">Własne zapisane komponenty i szablony — planowane w kolejnym etapie (40.2).</div>
                </>
              ) : (
                <div className="space-y-1">
                  <button onClick={() => setSel(null)} className={`w-full px-2 py-1.5 text-left text-xs ${!sel ? "text-gold" : "text-muted-foreground"}`}>Ustawienia strony</button>
                  {d.sections.map((s, i) => (
                    <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/x-sec", String(i))} onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { const f = e.dataTransfer.getData("text/x-sec"); if (f !== "") move(Number(f), i); }}
                      className={`border ${sel?.i === i ? "border-gold/70" : "border-border/40"}`}>
                      <div className="flex items-center gap-1 px-1 py-1">
                        <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground" />
                        <button className="text-[0.65rem] text-muted-foreground" onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))} aria-label="Zwiń lub rozwiń">{collapsed[s.id] ? "▸" : "▾"}</button>
                        <button onClick={() => setSel({ i, el: "section" })} className={`min-w-0 flex-1 truncate text-left text-xs ${s.hidden ? "text-muted-foreground line-through" : ""}`}>{i + 1}. {SECTION_KINDS[s.kind]}{s.heading ? ` — ${s.heading}` : ""}</button>
                        <button title="Duplikuj" onClick={() => duplicate(i)}><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button title={s.hidden ? "Pokaż" : "Ukryj"} onClick={() => toggleHidden(i)}>{s.hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button title="Usuń" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                      {!collapsed[s.id] && (
                        <div className="pb-1 pl-7">
                          {elementsOf(s).map(([el, label]) => (
                            <button key={el} onClick={() => setSel({ i, el })} className={`block w-full truncate px-1 py-0.5 text-left text-[0.7rem] ${sel?.i === i && sel.el === el ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!d.sections.length && <p className="p-2 text-xs text-muted-foreground">Strona nie ma jeszcze sekcji. Dodaj pierwszą z zakładki „Elementy”.</p>}
                  <p className="pt-2 text-[0.65rem] text-muted-foreground">Kolejność zmieniasz przeciągając wiersze. Elementy wewnątrz sekcji należą do niej — przenoszenie między sekcjami nie jest obsługiwane w tej wersji.</p>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Preview */}
        <main className="relative flex min-w-0 flex-1 justify-center overflow-hidden bg-muted/20 p-0 sm:p-3">
          {overflow.length > 0 && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 border border-destructive/60 bg-background px-3 py-1 text-xs text-destructive">
              Uwaga: sekcja {overflow.map((x) => x + 1).join(", ")} wychodzi poza ekran w tym widoku.
            </div>
          )}
          <Frame width={WIDTH[device]} onOverflow={useCallback((b: number[]) => setOverflow((o) => (o.join() === b.join() ? o : b)), [])}>
            <PageView eyebrow="Tata Na Baczności" title={d.title || "(bez tytułu)"} intro={d.intro} sections={d.sections} imageSrc={(f) => urls[f]}
              edit={{ sel, zone, onSelect: (s, locked) => {
                if (locked) { toast.message("Nagłówek i stopka nie są jeszcze edytowalne wizualnie — działają normalnie."); return; }
                setSel(s); if (s) { setRightOpen(true); setLeft((l) => (window.innerWidth < 1024 ? null : l)); }
              } }} />
          </Frame>
        </main>

        {/* Right panel */}
        {rightOpen && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-[320px] max-w-[90vw] flex-col border-l border-border/60 bg-card lg:static">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
              <p className="text-xs uppercase tracking-wide text-gold">{selSection ? `${sel!.i + 1}. ${SECTION_KINDS[selSection.kind]}` : "Ustawienia strony"}</p>
              <button aria-label="Zamknij panel" onClick={() => setRightOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {selSection && sel ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setSel({ i: sel.i, el: "section" })}>Sekcja</Button>
                    <Button size="icon" variant="ghost" aria-label="W górę" onClick={() => move(sel.i, sel.i - 1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="W dół" onClick={() => move(sel.i, sel.i + 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Duplikuj" onClick={() => duplicate(sel.i)}><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={selSection.hidden ? "Pokaż" : "Ukryj"} onClick={() => toggleHidden(sel.i)}>{selSection.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                    <Button size="icon" variant="ghost" aria-label="Usuń sekcję" onClick={() => remove(sel.i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Inspector s={selSection} el={sel.el} busy={saveState.busy} imageUrl={selSection.image ? urls[selSection.image] : undefined}
                    onPatch={(patch, key) => setSections((a) => a.map((x, j) => (j === sel.i ? { ...x, ...patch } : x)), key && `${sel.i}:${key}`)}
                    onSelectEl={(el) => setSel({ i: sel.i, el })} onUpload={(f) => upload(sel.i, f)} />
                </>
              ) : (
                <PagePanel d={d} system={system ? system.path : null} onPatch={(patch, key) => change((o) => ({ ...o, ...patch }), key)} />
              )}
            </div>
          </aside>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4" onClick={() => setModal(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-border/60 bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold uppercase">{modal === "history" ? "Historia wersji" : modal === "coverage" ? "Zasięg edycji wizualnej" : "Opublikować zmiany?"}</h2><button aria-label="Zamknij" onClick={() => setModal(null)}><X className="h-4 w-4" /></button></div>
            {modal === "publish" && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">Szkic zastąpi publiczną wersję strony {pagePath({ slug: d.slug, system_key: meta.system_key })}. Poprzednia wersja zostanie w historii i można ją przywrócić.</p>
                <ChangeList items={diffDrafts(meta.live, d)} />
                <div className="flex gap-2"><Button disabled={saveState.busy} onClick={publish}>Tak, opublikuj</Button><Button variant="outline" onClick={() => setModal(null)}>Anuluj</Button></div>
              </div>
            )}
            {modal === "coverage" && (
              <table className="mt-4 w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Obszar</th><th className="py-1 pr-2">Stan</th><th className="py-1">Uwagi</th></tr></thead>
                <tbody>{COVERAGE.map((r) => (
                  <tr key={r.area} className="border-t border-border/40 align-top"><td className="py-1.5 pr-2">{r.area}</td><td className={`py-1.5 pr-2 ${r.ok ? "text-gold" : "text-muted-foreground"}`}>{r.ok ? "Edycja wizualna" : "Nieobsługiwane — działa normalnie"}</td><td className="py-1.5 text-muted-foreground">{r.note}</td></tr>
                ))}</tbody>
              </table>
            )}
            {modal === "history" && (
              <div className="mt-4 space-y-2 text-sm">
                {!versions && <p className="text-muted-foreground">Wczytywanie…</p>}
                {versions?.length === 0 && <p className="text-muted-foreground">Brak zapisanych wersji. Wersja powstaje po kliknięciu „Zapisz szkic” lub „Opublikuj”.</p>}
                {versions?.map((v) => (
                  <div key={v.id} className="border border-border/50 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-gold">{v.kind === "publish" ? "Publikacja" : v.kind === "restore" ? "Przywrócenie" : "Szkic"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("pl-PL")}</span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPreview(preview?.id === v.id ? null : v)}>{preview?.id === v.id ? "Ukryj różnice" : "Różnice z bieżącym szkicem"}</Button>
                      <Button size="sm" variant="outline" onClick={() => restore(v)}>Przywróć</Button>
                    </div>
                    {preview?.id === v.id && <div className="mt-2"><ChangeList items={diffDrafts({ ...v.snapshot, sections: normalizeSections(v.snapshot.sections) }, d)} /></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Brak różnic.</p>;
  return <ul className="space-y-1 text-xs">{items.map((t, i) => <li key={i} className="border-l-2 border-gold/60 pl-2">{t}</li>)}</ul>;
}

function elementsOf(s: PageSection): [string, string][] {
  const out: [string, string][] = [];
  if (s.eyebrow) out.push(["eyebrow", "Nadtytuł"]);
  if (s.heading) out.push(["heading", "Nagłówek"]);
  if (s.body) out.push(["body", s.kind === "quote" ? "Cytat" : "Tekst"]);
  if (s.quoteAuthor) out.push(["quoteAuthor", "Autor cytatu"]);
  if (s.image) out.push(["image", "Zdjęcie"]);
  if (s.caption) out.push(["caption", "Podpis"]);
  s.items.forEach((it, k) => out.push([`item-${k}`, `${s.kind === "values" ? "Karta" : "Kolumna"}: ${it.title || k + 1}`]));
  s.buttons.forEach((b, k) => out.push([`button-${k}`, `Przycisk: ${b.label || k + 1}`]));
  return out;
}

export { Plus };
