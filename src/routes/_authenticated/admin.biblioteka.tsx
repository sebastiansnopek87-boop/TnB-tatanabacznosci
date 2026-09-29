import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminGetLibraryItem, adminListLibrary, adminRemoveLibraryFile, adminSaveLibraryItem, adminSetLibraryStatus, adminUploadLibraryFile } from "@/lib/library.functions";
import { ACCESS, KINDS, STATUS, listCategories, slugify, type Access, type Kind, type Status } from "@/lib/library";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/biblioteka")({ component: AdminLibrary });

type Form = { id: string | null; title: string; slug: string; summary: string; category: string; kind: Kind; access: Access; status: Status; author_name: string; body: string; external_url: string };
const EMPTY: Form = { id: null, title: "", slug: "", summary: "", category: "", kind: "article", access: "members", status: "draft", author_name: "Redakcja TNB", body: "", external_url: "" };

function AdminLibrary() {
  const listFn = useServerFn(adminListLibrary);
  const statusFn = useServerFn(adminSetLibraryStatus);
  const qc = useQueryClient();
  const [input, setInput] = useState(""); const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  useEffect(() => { const t = setTimeout(() => setQ(input), 300); return () => clearTimeout(t); }, [input]);

  const cats = useQuery({ queryKey: ["library-cats"], queryFn: listCategories });
  const list = useQuery({ queryKey: ["admin-library", q, status, category, access], queryFn: () => listFn({ data: { q, status, category, access } }) });
  const setSt = useMutation({
    mutationFn: (v: { id: string; status: Status }) => statusFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(`Status: ${STATUS[v.status]}`); qc.invalidateQueries({ queryKey: ["admin-library"] }); qc.invalidateQueries({ queryKey: ["library"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const catName = (s: string) => cats.data?.find((c) => c.slug === s)?.name ?? s;

  if (editing) return <Editor id={editing === "new" ? null : editing} cats={cats.data ?? []} onClose={() => setEditing(null)} onSaved={(id) => setEditing(id)} />;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Biblioteka</h1>
        <Button onClick={() => setEditing("new")}>+ Nowy materiał</Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Szukaj po tytule, opisie, adresie…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={100} />
        <Select value={status} onValueChange={(v) => setStatus(v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Wszystkie statusy</SelectItem>{(Object.keys(STATUS) as Status[]).map((s) => <SelectItem key={s} value={s}>{STATUS[s]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={category ?? "all"} onValueChange={(v) => setCategory(v === "all" ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Wszystkie kategorie</SelectItem>{cats.data?.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={access ?? "all"} onValueChange={(v) => setAccess(v === "all" ? null : (v as Access))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Każdy dostęp</SelectItem>{(Object.keys(ACCESS) as Access[]).map((a) => <SelectItem key={a} value={a}>{ACCESS[a]}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !list.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak materiałów{q || status !== "all" || category || access ? " dla wybranych filtrów" : ". Dodaj pierwszy materiał"}.</p>
          : list.data.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground">{r.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">/{r.slug} · {catName(r.category)} · {KINDS[r.kind as Kind]} · zmieniono {fmtDate(r.updated_at)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={r.status === "published" ? "default" : "outline"}>{STATUS[r.status as Status]}</Badge>
                  <Badge variant="outline">{ACCESS[r.access as Access]}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(r.id)}>Edytuj</Button>
                {r.status !== "published" && <Button size="sm" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: r.id, status: "published" })}>Opublikuj</Button>}
                {r.status === "published" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: r.id, status: "draft" })}>Cofnij do szkicu</Button>}
                {r.status !== "archived" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: r.id, status: "archived" })}>Archiwizuj</Button>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function toBase64(f: File) {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
}

function Editor({ id, cats, onClose, onSaved }: { id: string | null; cats: { slug: string; name: string }[]; onClose: () => void; onSaved: (id: string) => void }) {
  const getFn = useServerFn(adminGetLibraryItem);
  const saveFn = useServerFn(adminSaveLibraryItem);
  const upFn = useServerFn(adminUploadLibraryFile);
  const rmFn = useServerFn(adminRemoveLibraryFile);
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "file" | null>(null);
  const cur = useQuery({ queryKey: ["admin-library-item", id], queryFn: () => getFn({ data: { id: id! } }), enabled: !!id });

  useEffect(() => {
    if (!cur.data) return;
    const { item: i, content: c } = cur.data;
    setF({ id: i.id, title: i.title, slug: i.slug, summary: i.summary, category: i.category, kind: i.kind as Kind, access: i.access as Access, status: i.status as Status, author_name: i.author_name, body: c.body ?? "", external_url: c.external_url ?? "" });
    setSlugTouched(true);
  }, [cur.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v, ...(k === "title" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));

  const save = useMutation({
    mutationFn: (status: Status) => saveFn({ data: { ...f, status } }),
    onSuccess: (r, st) => {
      setErr(null); toast.success(st === "published" ? "Materiał opublikowany." : st === "draft" ? "Szkic zapisany." : "Zapisano.");
      qc.invalidateQueries({ queryKey: ["admin-library"] }); qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["admin-library-item", r.id] });
      setF((p) => ({ ...p, status: st, id: r.id })); onSaved(r.id);
    },
    onError: (e) => {
      const m = errMsg(e);
      try { const arr = JSON.parse(m); setErr(arr[0]?.message ?? m); } catch { setErr(m); }
    },
  });

  async function upload(target: "cover" | "file", file: File | undefined) {
    if (!file || !f.id) return;
    setUploading(target);
    try {
      await upFn({ data: { id: f.id, target, name: file.name, type: file.type, base64: await toBase64(file) } });
      toast.success(target === "cover" ? "Okładka zapisana." : "Plik zapisany.");
      qc.invalidateQueries({ queryKey: ["admin-library-item", f.id] }); qc.invalidateQueries({ queryKey: ["admin-library"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setUploading(null); }
  }
  async function remove(target: "cover" | "file") {
    if (!f.id) return;
    try { await rmFn({ data: { id: f.id, target } }); toast.success("Usunięto."); qc.invalidateQueries({ queryKey: ["admin-library-item", f.id] }); }
    catch (e) { toast.error(errMsg(e)); }
  }

  if (id && cur.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie materiału…</p>;
  if (id && cur.error) return <p className="text-sm text-destructive">{errMsg(cur.error)}</p>;
  const needsFile = f.kind === "pdf" || f.kind === "audio" || f.kind === "video";
  const needsUrl = f.kind === "link" || f.kind === "video" || f.kind === "audio";

  return (
    <div className="max-w-3xl">
      <button onClick={onClose} className="text-sm text-gold hover:underline">← Wróć do listy</button>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">{f.id ? "Edycja materiału" : "Nowy materiał"}</h1>
        {f.id && <Badge variant="outline">{STATUS[f.status]}</Badge>}
      </div>

      <div className="mt-6 space-y-5">
        <div><Label htmlFor="lt">Tytuł</Label><Input id="lt" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} /></div>
        <div><Label htmlFor="ls">Adres (slug)</Label><Input id="ls" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} maxLength={120} />
          <p className="mt-1 text-xs text-muted-foreground">/biblioteka/{f.slug || "…"}</p></div>
        <div><Label htmlFor="lsum">Krótki opis (widoczny dla wszystkich)</Label><Textarea id="lsum" rows={3} value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={600} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Kategoria</Label>
            <Select value={f.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Typ</Label>
            <Select value={f.kind} onValueChange={(v) => set("kind", v as Kind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(KINDS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KINDS[k]}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Dostęp</Label>
            <Select value={f.access} onValueChange={(v) => set("access", v as Access)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(ACCESS) as Access[]).map((a) => <SelectItem key={a} value={a}>{ACCESS[a]}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div><Label htmlFor="la">Autor lub redaktor</Label><Input id="la" value={f.author_name} onChange={(e) => set("author_name", e.target.value)} maxLength={80} /></div>
        <div><Label htmlFor="lb">Treść {f.kind === "article" || f.kind === "guide" ? "" : "(opcjonalna)"}</Label>
          <Textarea id="lb" rows={14} value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={100000} />
          <p className="mt-1 text-xs text-muted-foreground">Akapity oddziel pustą linią. Treść widzą tylko osoby z odpowiednim dostępem.</p></div>
        {(needsUrl) && (
          <div><Label htmlFor="lu">Adres zewnętrzny (https://)</Label><Input id="lu" value={f.external_url} onChange={(e) => set("external_url", e.target.value)} maxLength={2000} placeholder="https://" /></div>
        )}

        <div className="space-y-4 border border-border/60 p-4">
          {!f.id ? <p className="text-sm text-muted-foreground">Okładkę i plik dodasz po pierwszym zapisaniu materiału.</p> : (<>
            <div>
              <Label>Okładka (JPG, PNG, WEBP, maks. 5 MB)</Label>
              <p className="text-xs text-muted-foreground">{cur.data?.item.cover_url ? "Okładka dodana." : "Brak okładki."}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={(e) => upload("cover", e.target.files?.[0])} className="max-w-xs" />
                {cur.data?.item.cover_url && <Button size="sm" variant="outline" onClick={() => remove("cover")}>Usuń okładkę</Button>}
              </div>
            </div>
            {needsFile && (
              <div>
                <Label>Plik materiału (PDF, MP3, M4A, WAV, MP4, WEBM, maks. 25 MB)</Label>
                <p className="text-xs text-muted-foreground">{cur.data?.content.file_name ?? "Brak pliku."}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input type="file" accept=".pdf,.mp3,.m4a,.wav,.mp4,.webm" disabled={!!uploading} onChange={(e) => upload("file", e.target.files?.[0])} className="max-w-xs" />
                  {cur.data?.content.file_path && <Button size="sm" variant="outline" onClick={() => remove("file")}>Usuń plik</Button>}
                </div>
              </div>
            )}
            {uploading && <p className="text-xs text-muted-foreground">Przesyłanie…</p>}
          </>)}
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(f.status === "published" ? "published" : f.status === "archived" ? "archived" : "draft")}>
            {f.status === "published" ? "Zapisz zmiany" : f.status === "archived" ? "Zapisz (archiwalny)" : "Zapisz szkic"}
          </Button>
          {f.status !== "published" && <Button disabled={save.isPending} onClick={() => save.mutate("published")}>Zapisz i opublikuj</Button>}
          {f.status === "published" && <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>Cofnij do szkicu</Button>}
          {f.id && f.status !== "archived" && <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("archived")}>Archiwizuj</Button>}
        </div>
      </div>
    </div>
  );
}
