import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errMsg } from "@/components/admin/format";
import { PageView } from "@/components/pages/PageView";
import { SectionsEditor } from "@/components/pages/SectionsEditor";
import {
  adminCheckSlug, adminCreatePageUpload, adminGetPage, adminListPages, adminPageImageUrls, adminSavePage, adminSetPageStatus,
} from "@/lib/pages.functions";
import { PAGE_STATUS, SYSTEM_PAGES, normalizeSections, pagePath, type PageSection } from "@/lib/pages";

export const Route = createFileRoute("/_authenticated/admin/strony")({ component: PagesAdmin });

type Draft = { id: string | null; slug: string; system_key: string | null; title: string; intro: string; sections: PageSection[]; seo_title: string; seo_description: string; status: string };
const EMPTY: Draft = { id: null, slug: "", system_key: null, title: "", intro: "", sections: [], seo_title: "", seo_description: "", status: "draft" };

function PagesAdmin() {
  const listFn = useServerFn(adminListPages);
  const list = useQuery({ queryKey: ["admin-pages"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  if (editing) return <Editor id={editing === "new" ? null : editing} onClose={() => { setEditing(null); list.refetch(); }} />;
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Strony</h1>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nowa podstrona</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Treść stron „O TNB”, „Moja historia” i kolejnych podstron. Publicznie widać tylko opublikowane wersje.</p>
      {list.isLoading && <p className="mt-6 text-sm text-muted-foreground">Wczytywanie…</p>}
      {list.error && <p className="mt-6 text-sm text-destructive">{errMsg(list.error)}</p>}
      <div className="mt-6 divide-y divide-border/60 border border-border/60">
        {(list.data ?? []).map((p) => (
          <button key={p.id} onClick={() => setEditing(p.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-muted/30">
            <span><span className="font-medium">{p.title}</span> <span className="text-xs text-muted-foreground">{pagePath(p)}</span></span>
            <span className="text-xs uppercase tracking-wide text-gold">{PAGE_STATUS[p.status]}</span>
          </button>
        ))}
        {list.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Brak stron.</p>}
      </div>
    </div>
  );
}

function Editor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetPage); const saveFn = useServerFn(adminSavePage); const statusFn = useServerFn(adminSetPageStatus);
  const slugFn = useServerFn(adminCheckSlug); const upFn = useServerFn(adminCreatePageUpload); const urlsFn = useServerFn(adminPageImageUrls);
  const [d, setD] = useState<Draft>(EMPTY);
  const [pageId, setPageId] = useState<string | null>(id);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [slugMsg, setSlugMsg] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let live = true; // a late duplicate load must never overwrite edits already typed
    getFn({ data: { id } }).then((p) => { if (!live) return; setD({ ...EMPTY, ...p, sections: normalizeSections(p.sections) }); setLoading(false); }).catch((e) => { if (live) { toast.error(errMsg(e)); onClose(); } });
    return () => { live = false; };
  }, [id]);
  const names = d.sections.map((s) => s.image).filter(Boolean) as string[];
  useEffect(() => {
    const missing = names.filter((n) => !urls[n]);
    if (pageId && missing.length) urlsFn({ data: { id: pageId, names: missing } }).then((u) => setUrls((o) => ({ ...o, ...u }))).catch(() => {});
  }, [pageId, names.join(",")]);

  const set = (patch: Partial<Draft>) => { setD((o) => ({ ...o, ...patch })); setDirty(true); };
  // Functional updates: async callbacks (image upload) must not overwrite edits made meanwhile.
  const setSec = (i: number, patch: Partial<PageSection>) => { setD((o) => ({ ...o, sections: o.sections.map((s, j) => j === i ? { ...s, ...patch } : s) })); setDirty(true); };

  async function save(): Promise<string | null> {
    setBusy(true);
    try {
      const r = await saveFn({ data: { id: pageId, slug: d.slug, title: d.title, intro: d.intro, sections: d.sections, seo_title: d.seo_title, seo_description: d.seo_description } });
      setPageId(r.id); setDirty(false); qc.invalidateQueries({ queryKey: ["admin-pages"] }); toast.success("Zapisano szkic zmian.");
      return r.id;
    } catch (e) { toast.error(errMsg(e)); return null; } finally { setBusy(false); }
  }
  async function setStatus(status: "draft" | "published" | "archived") {
    const pid = dirty || !pageId ? await save() : pageId;
    if (!pid) return;
    setBusy(true);
    try { await statusFn({ data: { id: pid, status } }); set({ status }); setDirty(false); toast.success(status === "published" ? "Opublikowano." : status === "archived" ? "Zarchiwizowano." : "Cofnięto publikację."); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function checkSlug() {
    if (!d.slug) return setSlugMsg("");
    const r = await slugFn({ data: { slug: d.slug, id: pageId } });
    setSlugMsg(r.ok ? "Adres jest wolny." : r.reason);
  }
  async function upload(i: number, file: File) {
    const pid = pageId ?? await save();
    if (!pid) return;
    setBusy(true);
    try {
      const { path, token, name } = await upFn({ data: { id: pid, type: file.type, size: file.size } });
      const { error } = await supabase.storage.from("page-images").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Nie udało się wgrać zdjęcia.");
      setUrls((o) => ({ ...o, [name]: URL.createObjectURL(file) }));
      setSec(i, { image: name });
      toast.message("Zdjęcie dodane — zapisz zmiany.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Wczytywanie…</p>;
  if (preview) return (
    <div>
      <div className="mb-3 flex gap-2"><Button variant="outline" onClick={() => setPreview(false)}>← Wróć do edycji</Button></div>
      <div className="border border-border/60">
        <PageView preview eyebrow="Tata Na Baczności" title={d.title || "(bez tytułu)"} intro={d.intro} sections={d.sections} imageSrc={(f) => urls[f]} />
      </div>
    </div>
  );

  const system = d.system_key ? SYSTEM_PAGES[d.system_key] : null;
  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => { if (!dirty || confirm("Masz niezapisane zmiany. Wyjść?")) onClose(); }}>← Lista stron</Button>
        <span className="text-xs uppercase tracking-wide text-gold">{PAGE_STATUS[d.status]}{dirty ? " · niezapisane zmiany" : ""}</span>
      </div>
      {d.status === "published" && <p className="border border-gold/40 p-3 text-xs text-muted-foreground">Zapisane zmiany w opublikowanej stronie są od razu widoczne publicznie. Chcesz pracować spokojnie? Najpierw kliknij „Cofnij publikację”.</p>}

      <Field label="Tytuł strony"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} /></Field>
      <Field label="Adres strony">
        {system ? <p className="text-sm text-muted-foreground">{system.path} — stały adres z menu, nie podlega zmianie.</p> : (
          <>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">/strony/</span>
              <Input value={d.slug} onChange={(e) => { set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }); setSlugMsg(""); }} onBlur={checkSlug} maxLength={120} /></div>
            {slugMsg && <p className="mt-1 text-xs text-muted-foreground">{slugMsg}</p>}
          </>
        )}
      </Field>
      <Field label="Wstęp (pod tytułem)"><Textarea rows={3} value={d.intro} onChange={(e) => set({ intro: e.target.value })} maxLength={2000} /></Field>

      <SectionsEditor sections={d.sections} urls={urls} busy={busy} onChange={(fn) => { setD((o) => ({ ...o, sections: fn(o.sections) })); setDirty(true); }} onUpload={upload} />

      <div className="space-y-3 border border-border/60 p-4">
        <h2 className="font-display text-lg font-semibold uppercase">SEO</h2>
        <Field label={`Tytuł w wyszukiwarce (${d.seo_title.length}/70)`}><Input value={d.seo_title} onChange={(e) => set({ seo_title: e.target.value })} maxLength={70} placeholder={`${d.title || "Tytuł"} — Tata Na Baczności`} /></Field>
        <Field label={`Opis w wyszukiwarce (${d.seo_description.length}/170)`}><Textarea rows={2} value={d.seo_description} onChange={(e) => set({ seo_description: e.target.value })} maxLength={170} /></Field>
      </div>

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border/60 bg-background py-3">
        <Button onClick={save} disabled={busy}>{d.status === "published" ? "Zapisz zmiany" : "Zapisz szkic"}</Button>
        <Button variant="outline" onClick={() => setPreview(true)}>Podgląd</Button>
        {d.status !== "published" && <Button variant="outline" disabled={busy} onClick={() => setStatus("published")}>Opublikuj</Button>}
        {d.status === "published" && <Button variant="outline" disabled={busy} onClick={() => setStatus("draft")}>Cofnij publikację</Button>}
        {d.status !== "archived" && pageId && <Button variant="ghost" disabled={busy} onClick={() => confirm("Zarchiwizować stronę? Zniknie z widoku publicznego.") && setStatus("archived")}>Archiwizuj</Button>}
        {d.status === "published" && pageId && <a href={pagePath(d)} target="_blank" rel="noreferrer" className="self-center text-xs text-gold underline">Zobacz stronę</a>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}
