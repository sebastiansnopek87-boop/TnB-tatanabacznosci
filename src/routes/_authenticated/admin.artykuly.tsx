import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errMsg } from "@/components/admin/format";
import { SectionsEditor } from "@/components/pages/SectionsEditor";
import { ArticleView } from "@/components/articles/ArticleView";
import {
  adminArticleImageUrls, adminCheckArticleSlug, adminCreateArticleUpload, adminDeleteCategory, adminGetArticle, adminListArticles,
  adminSaveArticle, adminSaveCategory, adminSetArticleStatus, adminSetFeatured, adminSetHomeMode,
  adminArticleInteractions, adminSavePoll, adminDeletePoll, adminListArticleComments, adminModerateArticleComment,
} from "@/lib/articles.functions";
import { REACTIONS } from "@/lib/article-interactions";
import { ARTICLE_KINDS, ARTICLE_STATUS, HOME_MODE, articleCategoriesQuery, fmtArticleDate, readingMinutes, type HomeMode } from "@/lib/articles";
import { newSection, normalizeSections, type PageSection } from "@/lib/pages";
import { slugify } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/artykuly")({ component: ArticlesAdmin });

type Draft = {
  id: string | null; slug: string; title: string; excerpt: string; category: string | null; author_name: string; cover: string | null; cover_alt: string;
  sections: PageSection[]; published_at: string | null; featured: boolean; home_order: number; seo_title: string; seo_description: string; status: string;
  reflection_question: string; discussion_question: string;
};
const EMPTY: Draft = {
  id: null, slug: "", title: "", excerpt: "", category: null, author_name: "Sebastian Snopek", cover: null, cover_alt: "",
  sections: [newSection("text")], published_at: null, featured: false, home_order: 0, seo_title: "", seo_description: "", status: "draft",
  reflection_question: "", discussion_question: "",
};
// datetime-local works in local time; stored value is ISO with offset.
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function ArticlesAdmin() {
  const [tab, setTab] = useState<"list" | "categories" | "comments">("list");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  if (editing) return <Editor id={editing === "new" ? null : editing} onClose={() => setEditing(null)} />;
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Artykuły</h1>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nowy artykuł</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Autorskie teksty redakcyjne. Niezależne od Rozmów społeczności i Biblioteki. Publicznie widać tylko opublikowane artykuły z datą publikacji, która już minęła.</p>
      <div className="mt-6 flex gap-1 border-b border-border/60" role="tablist">
        {(["list", "categories", "comments"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground"}`}>
            {t === "list" ? "Artykuły i strona główna" : t === "categories" ? "Kategorie" : "Komentarze"}
          </button>
        ))}
      </div>
      {tab === "list" ? <List onEdit={setEditing} /> : tab === "categories" ? <Categories /> : <CommentsModeration />}
    </div>
  );
}

function List({ onEdit }: { onEdit: (id: string) => void }) {
  const listFn = useServerFn(adminListArticles); const modeFn = useServerFn(adminSetHomeMode); const featFn = useServerFn(adminSetFeatured);
  const list = useQuery({ queryKey: ["admin-articles"], queryFn: () => listFn() });
  const qc = useQueryClient();
  async function setMode(mode: HomeMode) {
    try { await modeFn({ data: { mode } }); toast.success("Zapisano ustawienie strony głównej."); list.refetch(); qc.invalidateQueries({ queryKey: ["articles"] }); } catch (e) { toast.error(errMsg(e)); }
  }
  async function feature(id: string, featured: boolean, home_order: number) {
    try { await featFn({ data: { id, featured, home_order } }); list.refetch(); qc.invalidateQueries({ queryKey: ["articles"] }); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <>
      <div className="mt-6 border border-border/60 p-4">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Artykuły na stronie głównej (3 karty)</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
          {(Object.keys(HOME_MODE) as HomeMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="radio" name="home-mode" checked={list.data?.homeMode === m} onChange={() => setMode(m)} disabled={!list.data} />{HOME_MODE[m]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">W trybie wyróżnionych: najpierw artykuły z gwiazdką według kolejności (mniejsza liczba = wyżej), brakujące miejsca uzupełniają najnowsze. </p>
      </div>
      {list.isLoading && <p className="mt-6 text-sm text-muted-foreground">Wczytywanie…</p>}
      {list.error && <p className="mt-6 text-sm text-destructive">{errMsg(list.error)}</p>}
      <div className="mt-6 divide-y divide-border/60 border border-border/60">
        {(list.data?.items ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
            <button onClick={() => onEdit(a.id)} className="min-w-0 flex-1 text-left hover:text-gold">
              <span className="block font-medium">{a.title}</span>
              <span className="block truncate text-xs text-muted-foreground">/artykuly/{a.slug} · {a.published_at ? fmtArticleDate(a.published_at) : "bez daty"}</span>
            </button>
            <span className="text-xs uppercase tracking-wide text-gold">{ARTICLE_STATUS[a.status]}{a.status === "published" && a.published_at && new Date(a.published_at) > new Date() ? " (zaplanowany)" : ""}</span>
            <Button size="icon" variant="ghost" aria-label={a.featured ? "Usuń wyróżnienie" : "Wyróżnij na stronie głównej"} title={a.featured ? "Wyróżniony" : "Wyróżnij"} onClick={() => feature(a.id, !a.featured, a.home_order)}>
              <Star className={`h-4 w-4 ${a.featured ? "fill-gold text-gold" : ""}`} />
            </Button>
            {a.featured && <Input aria-label="Kolejność wyróżnienia" type="number" min={0} max={999} defaultValue={a.home_order} className="h-8 w-16" onBlur={(e) => { const n = Math.max(0, Math.min(999, Number(e.target.value) || 0)); if (n !== a.home_order) feature(a.id, true, n); }} />}
          </div>
        ))}
        {list.data?.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nie ma jeszcze artykułów.</p>}
      </div>
    </>
  );
}

function Categories() {
  const qc = useQueryClient();
  const cats = useQuery(articleCategoriesQuery());
  const saveFn = useServerFn(adminSaveCategory); const delFn = useServerFn(adminDeleteCategory);
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["articles", "categories"] });
  async function add() {
    try { await saveFn({ data: { original: null, slug: slugify(name).slice(0, 60), name, sort_order: (cats.data?.length ?? 0) + 1 } }); setName(""); refresh(); toast.success("Dodano kategorię."); } catch (e) { toast.error(errMsg(e)); }
  }
  async function rename(slug: string, n: string, sort: number) {
    try { await saveFn({ data: { original: slug, slug, name: n, sort_order: sort } }); refresh(); toast.success("Zapisano kategorię."); } catch (e) { toast.error(errMsg(e)); }
  }
  async function del(slug: string) {
    if (!confirm("Usunąć kategorię? Możliwe tylko, gdy nie używa jej żaden artykuł.")) return;
    try { await delFn({ data: { slug } }); refresh(); toast.success("Usunięto kategorię."); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa nowej kategorii" maxLength={80} /><Button onClick={add} disabled={name.trim().length < 2}>Dodaj</Button></div>
      <div className="divide-y divide-border/60 border border-border/60">
        {(cats.data ?? []).map((c) => (
          <div key={c.slug} className="flex flex-wrap items-center gap-2 p-3">
            <Input defaultValue={c.name} aria-label="Nazwa kategorii" className="min-w-0 flex-1" maxLength={80} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) rename(c.slug, v, c.sort_order); }} />
            <Input type="number" defaultValue={c.sort_order} aria-label="Kolejność" className="w-20" onBlur={(e) => { const n = Number(e.target.value) || 0; if (n !== c.sort_order) rename(c.slug, c.name, n); }} />
            <Button size="icon" variant="ghost" aria-label="Usuń kategorię" onClick={() => del(c.slug)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Zmiany nazwy i kolejności zapisują się po opuszczeniu pola.</p>
    </div>
  );
}

function Editor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const cats = useQuery(articleCategoriesQuery());
  const getFn = useServerFn(adminGetArticle); const saveFn = useServerFn(adminSaveArticle); const statusFn = useServerFn(adminSetArticleStatus);
  const slugFn = useServerFn(adminCheckArticleSlug); const upFn = useServerFn(adminCreateArticleUpload); const urlsFn = useServerFn(adminArticleImageUrls);
  const [d, setD] = useState<Draft>(EMPTY);
  const [artId, setArtId] = useState<string | null>(id);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [slugMsg, setSlugMsg] = useState("");
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let live = true;
    getFn({ data: { id } }).then((a) => { if (!live) return; setD({ ...EMPTY, ...a, sections: normalizeSections(a.sections) }); setLoading(false); })
      .catch((e) => { if (live) { toast.error(errMsg(e)); onClose(); } });
    return () => { live = false; };
  }, [id]);
  const names = [d.cover, ...d.sections.map((s) => s.image)].filter(Boolean) as string[];
  useEffect(() => {
    const missing = names.filter((n) => !urls[n]);
    if (artId && missing.length) urlsFn({ data: { id: artId, names: missing } }).then((u) => setUrls((o) => ({ ...o, ...u }))).catch(() => {});
  }, [artId, names.join(",")]);

  const set = (patch: Partial<Draft>) => { setD((o) => ({ ...o, ...patch })); setDirty(true); };
  const setSec = (i: number, patch: Partial<PageSection>) => { setD((o) => ({ ...o, sections: o.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })); setDirty(true); };

  async function save(): Promise<string | null> {
    if (!d.slug) { toast.error("Podaj adres artykułu."); return null; }
    setBusy(true);
    try {
      const r = await saveFn({ data: {
        id: artId, slug: d.slug, title: d.title, excerpt: d.excerpt, category: d.category, author_name: d.author_name, cover: d.cover, cover_alt: d.cover_alt,
        sections: d.sections, published_at: d.published_at, featured: d.featured, home_order: d.home_order, seo_title: d.seo_title, seo_description: d.seo_description,
        reflection_question: d.reflection_question, discussion_question: d.discussion_question,
      } });
      setArtId(r.id); setDirty(false); qc.invalidateQueries({ queryKey: ["admin-articles"] }); qc.invalidateQueries({ queryKey: ["articles"] });
      toast.success(d.status === "published" ? "Zapisano zmiany." : "Zapisano szkic.");
      return r.id;
    } catch (e) { toast.error(errMsg(e)); return null; } finally { setBusy(false); }
  }
  async function setStatus(status: "draft" | "published" | "archived") {
    const aid = dirty || !artId ? await save() : artId;
    if (!aid) return;
    setBusy(true);
    try {
      const r = await statusFn({ data: { id: aid, status } });
      setD((o) => ({ ...o, status, published_at: r.published_at ?? o.published_at })); setDirty(false);
      qc.invalidateQueries({ queryKey: ["articles"] });
      toast.success(status === "published" ? "Opublikowano." : status === "archived" ? "Zarchiwizowano." : "Cofnięto do szkicu.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function checkSlug() {
    if (!d.slug) return setSlugMsg("");
    const r = await slugFn({ data: { slug: d.slug, id: artId } });
    setSlugMsg(r.ok ? "Adres jest wolny." : r.reason);
  }
  async function uploadFile(file: File, done: (name: string) => void) {
    const aid = artId ?? await save();
    if (!aid) return;
    setBusy(true);
    try {
      const { path, token, name } = await upFn({ data: { id: aid, type: file.type, size: file.size } });
      const { error } = await supabase.storage.from("article-images").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Nie udało się wgrać zdjęcia.");
      setUrls((o) => ({ ...o, [name]: URL.createObjectURL(file) }));
      done(name);
      toast.message("Zdjęcie dodane — zapisz zmiany.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Wczytywanie…</p>;
  const catName = cats.data?.find((c) => c.slug === d.category)?.name ?? null;
  if (preview) return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPreview(false)}>← Wróć do edycji</Button>
        <Button variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}>Komputer</Button>
        <Button variant={device === "phone" ? "default" : "outline"} onClick={() => setDevice("phone")}>Telefon</Button>
      </div>
      <div className={`border border-border/60 ${device === "phone" ? "mx-auto max-w-[390px] overflow-hidden" : ""}`}>
        <ArticleView preview title={d.title || "(bez tytułu)"} excerpt={d.excerpt} category={catName} author={d.author_name} publishedAt={d.published_at}
          minutes={readingMinutes(d.excerpt, d.sections)} cover={d.cover ? urls[d.cover] : undefined} coverAlt={d.cover_alt} sections={d.sections} imageSrc={(f) => urls[f]} />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => { if (!dirty || confirm("Masz niezapisane zmiany. Wyjść?")) onClose(); }}>← Lista artykułów</Button>
        <span className="text-xs uppercase tracking-wide text-gold">{ARTICLE_STATUS[d.status]}{dirty ? " · niezapisane zmiany" : ""}</span>
      </div>
      {d.status === "published" && <p className="border border-gold/40 p-3 text-xs text-muted-foreground">Zapisane zmiany w opublikowanym artykule są od razu widoczne publicznie. Chcesz pracować spokojnie? Najpierw kliknij „Cofnij do szkicu”.</p>}

      <Field label="Tytuł"><Input value={d.title} maxLength={200} onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} /></Field>
      <Field label="Adres artykułu">
        <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">/artykuly/</span>
          <Input value={d.slug} maxLength={120} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }); setSlugMsg(""); }} onBlur={checkSlug} /></div>
        {slugMsg && <p className="mt-1 text-xs text-muted-foreground">{slugMsg}</p>}
      </Field>
      <Field label={`Zajawka (${d.excerpt.length}/600)`}><Textarea rows={3} value={d.excerpt} maxLength={600} onChange={(e) => set({ excerpt: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategoria">
          <select value={d.category ?? ""} onChange={(e) => set({ category: e.target.value || null })} className="h-9 w-full border border-border bg-background px-2 text-sm">
            <option value="">— bez kategorii —</option>
            {(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Autor"><Input value={d.author_name} maxLength={120} onChange={(e) => set({ author_name: e.target.value })} /></Field>
        <Field label="Data publikacji (pusta = w chwili publikacji)">
          <Input type="datetime-local" value={toLocal(d.published_at)} onChange={(e) => set({ published_at: fromLocal(e.target.value) })} />
        </Field>
        <Field label="Strona główna">
          <div className="flex h-9 items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.featured} onChange={(e) => set({ featured: e.target.checked })} />Wyróżniony</label>
            {d.featured && <Input type="number" min={0} max={999} aria-label="Kolejność" value={d.home_order} onChange={(e) => set({ home_order: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })} className="h-8 w-20" />}
          </div>
        </Field>
      </div>

      <Field label="Zdjęcie główne">
        <div className="space-y-2">
          {d.cover && urls[d.cover] && <img src={urls[d.cover]} alt="" className="max-h-48 border border-border/60" />}
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer border border-border px-3 py-1.5 text-xs hover:bg-muted/40">
              {d.cover ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, (n) => set({ cover: n })); e.target.value = ""; }} />
            </label>
            {d.cover && <Button size="sm" variant="ghost" onClick={() => set({ cover: null })}>Usuń zdjęcie</Button>}
          </div>
          {d.cover && <Input placeholder="Opis zdjęcia dla niewidomych (alt)" value={d.cover_alt} maxLength={200} onChange={(e) => set({ cover_alt: e.target.value })} />}
        </div>
      </Field>

      <div>
        <h2 className="font-display text-xl font-semibold uppercase">Treść</h2>
        <p className="mb-3 text-xs text-muted-foreground">Bloki: tekst z nagłówkiem (akapity oddzielaj pustą linią), cytat, zdjęcie, wezwanie do działania. Czas czytania liczy się automatycznie: ok. {readingMinutes(d.excerpt, d.sections)} min.</p>
        <SectionsEditor sections={d.sections} urls={urls} busy={busy} kinds={ARTICLE_KINDS}
          onChange={(fn) => { setD((o) => ({ ...o, sections: fn(o.sections) })); setDirty(true); }}
          onUpload={(i, f) => uploadFile(f, (n) => setSec(i, { image: n }))} />
      </div>

      <div className="space-y-3 border border-border/60 p-4">
        <h2 className="font-display text-lg font-semibold uppercase">Zatrzymaj się na chwilę</h2>
        <p className="text-xs text-muted-foreground">Sekcja pod artykułem. Puste pola nie są wyświetlane.</p>
        <Field label={`Pytanie do refleksji (${d.reflection_question.length}/400)`}><Textarea rows={2} maxLength={400} value={d.reflection_question} onChange={(e) => set({ reflection_question: e.target.value })} /></Field>
        <Field label={`Pytanie do dyskusji w komentarzach (${d.discussion_question.length}/400)`}><Textarea rows={2} maxLength={400} value={d.discussion_question} onChange={(e) => set({ discussion_question: e.target.value })} /></Field>
        {artId ? <PollAndStats id={artId} /> : <p className="text-xs text-muted-foreground">Ankietę i statystyki skonfigurujesz po pierwszym zapisaniu artykułu.</p>}
      </div>

      <div className="space-y-3 border border-border/60 p-4">
        <h2 className="font-display text-lg font-semibold uppercase">SEO</h2>
        <Field label={`Tytuł w wyszukiwarce (${d.seo_title.length}/70)`}><Input value={d.seo_title} maxLength={70} placeholder={`${d.title || "Tytuł"} — Tata Na Baczności`} onChange={(e) => set({ seo_title: e.target.value })} /></Field>
        <Field label={`Opis w wyszukiwarce (${d.seo_description.length}/170)`}><Textarea rows={2} value={d.seo_description} maxLength={170} placeholder="Pusty = początek zajawki" onChange={(e) => set({ seo_description: e.target.value })} /></Field>
      </div>

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border/60 bg-background py-3">
        <Button onClick={save} disabled={busy}>{d.status === "published" ? "Zapisz zmiany" : "Zapisz szkic"}</Button>
        <Button variant="outline" onClick={() => setPreview(true)}>Podgląd</Button>
        {d.status !== "published" && <Button variant="outline" disabled={busy} onClick={() => setStatus("published")}>Opublikuj</Button>}
        {d.status === "published" && <Button variant="outline" disabled={busy} onClick={() => setStatus("draft")}>Cofnij do szkicu</Button>}
        {d.status !== "archived" && artId && <Button variant="ghost" disabled={busy} onClick={() => confirm("Zarchiwizować artykuł? Zniknie z widoku publicznego.") && setStatus("archived")}>Archiwizuj</Button>}
        {d.status === "published" && artId && <a href={`/artykuly/${d.slug}`} target="_blank" rel="noreferrer" className="self-center text-xs text-gold underline">Zobacz artykuł</a>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

function PollAndStats({ id }: { id: string }) {
  const getFn = useServerFn(adminArticleInteractions); const saveFn = useServerFn(adminSavePoll); const delFn = useServerFn(adminDeletePoll);
  const q = useQuery({ queryKey: ["admin-article-int", id], queryFn: () => getFn({ data: { id } }) });
  const [poll, setPoll] = useState<{ question: string; options: string[]; active: boolean } | null>(null);
  useEffect(() => { if (q.data) setPoll(q.data.poll); }, [q.data]);
  const votes = q.data?.stats.poll ?? {}; const total = Object.values(votes).reduce((a, b) => a + b, 0);
  async function save() {
    if (!poll) return;
    try { await saveFn({ data: { id, ...poll, options: poll.options.map((o) => o.trim()) } }); toast.success("Zapisano ankietę."); q.refetch(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function del() {
    if (!confirm(total ? `Usunąć ankietę razem z ${total} głosami?` : "Usunąć ankietę?")) return;
    try { await delFn({ data: { id } }); toast.success("Usunięto ankietę."); setPoll(null); q.refetch(); } catch (e) { toast.error(errMsg(e)); }
  }
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Wczytywanie ankiety…</p>;
  const s = q.data?.stats;
  return (
    <div className="space-y-4">
      <div className="border-t border-border/60 pt-3">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Ankieta (opcjonalna)</h3>
        {!poll ? <Button size="sm" variant="outline" className="mt-2" onClick={() => setPoll({ question: "", options: ["", ""], active: true })}><Plus className="mr-1 h-4 w-4" />Dodaj ankietę</Button> : (
          <div className="mt-2 space-y-2">
            <Input placeholder="Pytanie ankiety" maxLength={200} value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} />
            {poll.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder={`Odpowiedź ${i + 1}`} maxLength={120} value={o} disabled={total > 0} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{votes[String(i)] ?? 0} gł.</span>
                {total === 0 && poll.options.length > 2 && <Button size="icon" variant="ghost" aria-label="Usuń odpowiedź" onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            {total === 0 && poll.options.length < 6 && <Button size="sm" variant="ghost" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}><Plus className="mr-1 h-4 w-4" />Dodaj odpowiedź</Button>}
            {total > 0 && <p className="text-xs text-muted-foreground">Ankieta ma {total} głosów — odpowiedzi są zablokowane, żeby wyniki zachowały sens.</p>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={poll.active} onChange={(e) => setPoll({ ...poll, active: e.target.checked })} />Głosowanie otwarte</label>
            <div className="flex gap-2"><Button size="sm" onClick={save}>Zapisz ankietę</Button>{q.data?.poll && <Button size="sm" variant="ghost" onClick={del}>Usuń ankietę</Button>}</div>
          </div>
        )}
      </div>
      <div className="border-t border-border/60 pt-3">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Statystyki czytelników (zbiorcze, anonimowe)</h3>
        <p className="mt-2 text-sm">Komentarze widoczne: {s?.comments ?? 0} · Głosy w ankiecie: {total}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {(Object.keys(REACTIONS) as (keyof typeof REACTIONS)[]).map((k) => <span key={k}>{REACTIONS[k]}: <b>{s?.reactions[k] ?? 0}</b></span>)}
        </div>
      </div>
    </div>
  );
}

function CommentsModeration() {
  const listFn = useServerFn(adminListArticleComments); const modFn = useServerFn(adminModerateArticleComment);
  const [filter, setFilter] = useState<"all" | "reported" | "hidden">("all");
  const q = useQuery({ queryKey: ["admin-article-comments", filter], queryFn: () => listFn({ data: { filter } }) });
  async function act(id: string, action: "hide" | "show" | "delete" | "dismiss") {
    if (action === "delete" && !confirm("Trwale usunąć komentarz?")) return;
    try { await modFn({ data: { id, action } }); toast.success("Zapisano."); q.refetch(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {([["all", "Wszystkie"], ["reported", "Zgłoszone"], ["hidden", "Ukryte"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Wczytywanie…</p>}
      {q.error && <p className="text-sm text-destructive">{errMsg(q.error)}</p>}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Brak komentarzy w tym widoku.</p>}
      <div className="divide-y divide-border/60 border border-border/60">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span><b className="text-foreground">{c.author_name}</b> · {c.article ? <a href={`/artykuly/${c.article.slug}`} target="_blank" rel="noreferrer" className="text-gold underline">{c.article.title}</a> : "—"}</span>
              <span>{new Date(c.created_at).toLocaleString("pl-PL")}</span>
            </div>
            <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
            {c.status === "hidden" && <p className="text-xs uppercase tracking-wide text-destructive">Ukryty</p>}
            {c.reports.length > 0 && <p className="text-xs text-destructive">Zgłoszenia ({c.reports.length}): {c.reports.map((r) => r || "bez powodu").join(" · ")}</p>}
            <div className="flex flex-wrap gap-2">
              {c.status === "visible" ? <Button size="sm" variant="outline" onClick={() => act(c.id, "hide")}>Ukryj</Button> : <Button size="sm" variant="outline" onClick={() => act(c.id, "show")}>Przywróć</Button>}
              {c.reports.length > 0 && <Button size="sm" variant="ghost" onClick={() => act(c.id, "dismiss")}>Odrzuć zgłoszenia</Button>}
              <Button size="sm" variant="ghost" onClick={() => act(c.id, "delete")}><Trash2 className="mr-1 h-4 w-4" />Usuń</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
