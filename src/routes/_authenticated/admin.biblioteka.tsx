import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminGetLibraryItem, adminListLibrary, adminRemoveLibraryFile, adminSaveLibraryItem, adminSetLibraryStatus, adminUploadLibraryFile, adminRetryWatermark, adminLibraryFileUrl } from "@/lib/library.functions";
import { adminListLibraryRequests, adminEraseLibraryRequest } from "@/lib/library-delivery.functions";
import { FREE_DELIVERY, type FreeDelivery } from "@/lib/library";
import { ACCESS, DELIVERY, KINDS, STATUS, accessLabel, listCategories, slugify, type Access, type Delivery, type Kind, type Status } from "@/lib/library";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/biblioteka")({ component: AdminLibrary });

type Form = { id: string | null; title: string; slug: string; summary: string; category: string; kind: Kind; access: Access; status: Status; author_name: string; body: string; external_url: string; price: string; purchasable: boolean; payment_product_id: string; delivery_method: Delivery; free_delivery: FreeDelivery };
const EMPTY: Form = { id: null, title: "", slug: "", summary: "", category: "", kind: "article", access: "members", status: "draft", author_name: "Redakcja TNB", body: "", external_url: "", price: "", purchasable: false, payment_product_id: "", delivery_method: "email_link", free_delivery: "direct" };

function AdminLibrary() {
  const listFn = useServerFn(adminListLibrary);
  const statusFn = useServerFn(adminSetLibraryStatus);
  const qc = useQueryClient();
  const [input, setInput] = useState(""); const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [tab, setTab] = useState<"items" | "history">("items");
  useEffect(() => { const t = setTimeout(() => setQ(input), 300); return () => clearTimeout(t); }, [input]);

  const cats = useQuery({ queryKey: ["library-cats"], queryFn: listCategories });
  const list = useQuery({ queryKey: ["admin-library", q, status, category, access], queryFn: () => listFn({ data: { q, status, category, access } }) });
  const setSt = useMutation({
    mutationFn: (v: { id: string; status: Status }) => statusFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(`Status: ${STATUS[v.status]}`); qc.invalidateQueries({ queryKey: ["admin-library"] }); qc.invalidateQueries({ queryKey: ["library"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const catName = (s: string) => cats.data?.find((c) => c.slug === s)?.name ?? s;

  const tabs = (
    <div className="mb-6 flex flex-wrap gap-2">
      <Button size="sm" variant={tab === "items" ? "default" : "outline"} onClick={() => setTab("items")}>Materiały</Button>
      <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")}>Historia udostępnień</Button>
    </div>
  );
  if (!editing && tab === "history") return <div className="max-w-5xl">{tabs}<History items={list.data ?? []} /></div>;
  if (editing) return <Editor id={editing === "new" ? null : editing} cats={cats.data ?? []} onClose={() => setEditing(null)} onSaved={(id) => setEditing(id)} />;

  return (
    <div className="max-w-5xl">
      {tabs}
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
                  <Badge variant="outline">{accessLabel({ access: r.access as Access, price_amount: r.price_amount })}</Badge>
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
  const retryFn = useServerFn(adminRetryWatermark);
  const urlFn = useServerFn(adminLibraryFileUrl);
  const [premarked, setPremarked] = useState(false);
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "file" | null>(null);
  const cur = useQuery({ queryKey: ["admin-library-item", id], queryFn: () => getFn({ data: { id: id! } }), enabled: !!id });

  useEffect(() => {
    if (!cur.data) return;
    const { item: i, content: c } = cur.data;
    setF({ id: i.id, title: i.title, slug: i.slug, summary: i.summary, category: i.category, kind: i.kind as Kind, access: i.access as Access, status: i.status as Status, author_name: i.author_name, body: c.body ?? "", external_url: c.external_url ?? "", price: i.price_amount != null ? String(i.price_amount / 100).replace(".", ",") : "", purchasable: !!i.purchasable, payment_product_id: i.payment_product_id ?? "", delivery_method: (i.delivery_method ?? "email_link") as Delivery, free_delivery: ((i as any).free_delivery ?? "direct") as FreeDelivery });
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
      const r = await upFn({ data: { id: f.id, target, name: file.name, type: file.type, base64: await toBase64(file), premarked } });
      if (r.watermark?.status === "failed") toast.error(`Błąd przetwarzania: ${r.watermark.error}`);
      else toast.success(target === "cover" ? "Okładka zapisana." : r.watermark ? "PDF oznaczony znakiem wodnym TNB." : "Plik zapisany.");
      qc.invalidateQueries({ queryKey: ["admin-library-item", f.id] }); qc.invalidateQueries({ queryKey: ["admin-library"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setUploading(null); }
  }
  async function remove(target: "cover" | "file") {
    if (!f.id) return;
    try { await rmFn({ data: { id: f.id, target } }); toast.success("Usunięto."); qc.invalidateQueries({ queryKey: ["admin-library-item", f.id] }); }
    catch (e) { toast.error(errMsg(e)); }
  }

  async function retry() {
    if (!f.id) return; setUploading("file");
    try { const r = await retryFn({ data: { id: f.id } }); r.status === "ready" ? toast.success("PDF oznaczony znakiem wodnym TNB.") : toast.error(`Błąd przetwarzania: ${r.error}`); }
    catch (e) { toast.error(errMsg(e)); } finally { setUploading(null); qc.invalidateQueries({ queryKey: ["admin-library-item", f.id] }); }
  }
  async function openUrl(which: "final" | "original", download: boolean) {
    if (!f.id) return;
    try { const r = await urlFn({ data: { id: f.id, which, download } }); window.open(r.url, "_blank", "noopener"); } catch (e) { toast.error(errMsg(e)); }
  }

  if (id && cur.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie materiału…</p>;
  if (id && cur.error) return <p className="text-sm text-destructive">{errMsg(cur.error)}</p>;
  const needsFile = f.kind !== "link";
  const c = cur.data?.content as (Record<string, any> | undefined);
  const wm = (c?.watermark_status ?? "none") as string;
  const stale = !!(c?.pdf_generated_at && c?.body_updated_at && new Date(c.body_updated_at) > new Date(c.pdf_generated_at));
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
        {f.access === "premium" && (
          <div className="grid gap-4 border border-gold/40 p-4 sm:grid-cols-2">
            <div><Label htmlFor="lp">Cena (zł)</Label><Input id="lp" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} maxLength={12} placeholder="np. 49,99" /></div>
            <div><Label>Sposób dostarczenia</Label>
              <Select value={f.delivery_method} onValueChange={(v) => set("delivery_method", v as Delivery)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DELIVERY) as Delivery[]).map((d) => <SelectItem key={d} value={d}>{DELIVERY[d]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="lpid">Identyfikator produktu u operatora płatności (opcjonalnie)</Label><Input id="lpid" value={f.payment_product_id} onChange={(e) => set("payment_product_id", e.target.value)} maxLength={120} /></div>
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.purchasable} onChange={(e) => set("purchasable", e.target.checked)} /> Dostępny do zakupu</label>
          </div>
        )}
        {f.access !== "premium" && (
          <div><Label>Sposób udostępnienia</Label>
            <Select value={f.free_delivery} onValueChange={(v) => set("free_delivery", v as FreeDelivery)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(FREE_DELIVERY) as FreeDelivery[]).map((d) => <SelectItem key={d} value={d}>{FREE_DELIVERY[d]}</SelectItem>)}</SelectContent></Select>
            <p className="mt-1 text-xs text-muted-foreground">{f.free_delivery === "direct" ? "Przycisk „Pobierz PDF” bez podawania danych." : f.free_delivery === "form_download" ? "Formularz: imię, nazwisko, e-mail — potem pobranie od razu." : "Formularz: imię, nazwisko, e-mail — link do pobrania wysyłany e-mailem (w środowisku testowym wysyłka symulowana)."} Dotyczy pliku PDF.</p></div>
        )}
        <div><Label htmlFor="la">Autor lub redaktor</Label><Input id="la" value={f.author_name} onChange={(e) => set("author_name", e.target.value)} maxLength={80} /></div>
        <div><Label htmlFor="lb">Treść (opcjonalna, gdy dodasz kompletny plik PDF)</Label>
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
                <p className="text-xs text-muted-foreground">Nowy PDF jest automatycznie oznaczany znakiem wodnym TNB (małe logo w prawym dolnym rogu każdej strony). Udostępniana jest tylko oznaczona wersja.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-foreground/80">{c?.file_name ?? "Brak pliku."}</span>
                  {wm !== "none" && <Badge variant={wm === "failed" ? "destructive" : wm === "ready" ? "default" : "outline"}>{WM[wm]}</Badge>}
                  {wm === "ready" && c?.watermark_source === "premarked" && <Badge variant="outline">Znak dodany przy składzie</Badge>}
                </div>
                {wm === "failed" && <p className="mt-1 text-sm text-destructive">{c?.watermark_error} Plik nie jest udostępniany.</p>}
                {c?.pdf_generated_at && <p className="mt-1 text-xs text-muted-foreground">Wersja PDF z {fmtDate(c.pdf_generated_at)}{c.body_updated_at ? ` · treść zmieniona ${fmtDate(c.body_updated_at)}` : ""}</p>}
                {stale && <p className="mt-1 text-sm text-destructive">Uwaga: treść edytowalna zmieniła się po wygenerowaniu PDF — plik może być nieaktualny.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c?.file_path && wm === "ready" && <Button size="sm" variant="outline" onClick={() => openUrl("final", false)}>Podgląd PDF</Button>}
                  {c?.file_path && <Button size="sm" variant="outline" onClick={() => openUrl("final", true)}>Pobierz do kontroli</Button>}
                  {c?.original_path && <Button size="sm" variant="outline" onClick={() => openUrl("original", true)}>Oryginał</Button>}
                  {wm === "failed" && c?.original_path && <Button size="sm" disabled={!!uploading} onClick={retry}>Ponów przetwarzanie</Button>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input type="file" accept=".pdf,.mp3,.m4a,.wav,.mp4,.webm" disabled={!!uploading} onChange={(e) => upload("file", e.target.files?.[0])} className="max-w-xs" />
                  {(c?.file_path || c?.original_path) && <Button size="sm" variant="outline" onClick={() => remove("file")}>Usuń plik</Button>}
                </div>
                <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5" checked={premarked} onChange={(e) => setPremarked(e.target.checked)} />Ten PDF ma już znak wodny TNB dodany przy składzie zgodnie ze standardem — nie dodawaj drugiego (decyzja zapisywana w Dzienniku zdarzeń).</label>
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

const WM: Record<string, string> = { pending: "Oczekuje na przetworzenie", processing: "Przetwarzanie", ready: "Gotowy", failed: "Błąd przetwarzania", none: "—" };
const REQ_STATUS: Record<string, string> = {
  accepted: "Zgłoszenie przyjęte", pending_send: "Oczekuje na wysyłkę", simulated: "Wysyłka symulowana (test)", sent: "Wysłano",
  download_ready: "Pobranie udostępnione", downloaded: "Pobranie zrealizowane", send_failed: "Błąd wysyłki", expired: "Link wygasł", cancelled: "Zgłoszenie anulowane / dane usunięte",
};

function History({ items }: { items: { id: string; title: string }[] }) {
  const listFn = useServerFn(adminListLibraryRequests);
  const eraseFn = useServerFn(adminEraseLibraryRequest);
  const qc = useQueryClient();
  const [itemId, setItemId] = useState<string | null>(null);
  const [emailIn, setEmailIn] = useState(""); const [email, setEmail] = useState("");
  const [mode, setMode] = useState<FreeDelivery | null>(null);
  const [st, setSt] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setEmail(emailIn), 300); return () => clearTimeout(t); }, [emailIn]);
  const q = useQuery({ queryKey: ["admin-lib-req", itemId, email, mode, st], queryFn: () => listFn({ data: { itemId, email, mode, status: st } }) });
  const erase = async (id: string) => {
    if (!confirm("Usunąć dane osobowe z tego zgłoszenia? Zostanie tylko anonimowy wpis.")) return;
    try { await eraseFn({ data: { id } }); toast.success("Dane usunięte."); qc.invalidateQueries({ queryKey: ["admin-lib-req"] }); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Historia udostępnień</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pobrania, zgłoszenia i wysyłki bezpłatnych materiałów. Dane osobowe widzą tylko administratorzy; są usuwane po 12 miesiącach.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={itemId ?? "all"} onValueChange={(v) => setItemId(v === "all" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Wszystkie materiały</SelectItem>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Szukaj po adresie e-mail" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} maxLength={100} />
        <Select value={mode ?? "all"} onValueChange={(v) => setMode(v === "all" ? null : (v as FreeDelivery))}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Każdy sposób</SelectItem>{(Object.keys(FREE_DELIVERY) as FreeDelivery[]).map((m) => <SelectItem key={m} value={m}>{FREE_DELIVERY[m]}</SelectItem>)}</SelectContent></Select>
        <Select value={st ?? "all"} onValueChange={(v) => setSt(v === "all" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Każdy status</SelectItem>{Object.entries(REQ_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="mt-6 space-y-2">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : q.error ? <p className="text-sm text-destructive">{errMsg(q.error)}</p>
          : !q.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak zdarzeń.</p>
          : q.data.map((r) => (
            <div key={r.id} className="border border-border/60 p-4">
              <button className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span className="min-w-0 break-words"><span className="font-medium">{r.item_title}</span><span className="block text-xs text-muted-foreground">{fmtDate(r.created_at)} · {FREE_DELIVERY[r.mode as FreeDelivery]} · {r.email ?? (r.user_id ? "zalogowany użytkownik" : "anonimowo")}</span></span>
                <Badge variant={r.status === "send_failed" ? "destructive" : "outline"}>{REQ_STATUS[r.status] ?? r.status}</Badge>
              </button>
              {open === r.id && (
                <dl className="mt-3 grid gap-x-4 gap-y-1 break-words text-xs sm:grid-cols-[12rem_1fr]">
                  <dt className="text-muted-foreground">Identyfikator zdarzenia</dt><dd>{r.id}</dd>
                  <dt className="text-muted-foreground">Materiał</dt><dd>{r.item_id}</dd>
                  <dt className="text-muted-foreground">Imię i nazwisko</dt><dd>{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</dd>
                  <dt className="text-muted-foreground">Użytkownik</dt><dd>{r.user_id ?? "—"}</dd>
                  <dt className="text-muted-foreground">Wysyłka</dt><dd>{r.notification_status ?? "—"}</dd>
                  <dt className="text-muted-foreground">Pobrano</dt><dd>{r.downloaded_at ? `${fmtDate(r.downloaded_at)} (×${r.download_count})` : "—"}</dd>
                  <dt className="text-muted-foreground">Link ważny do</dt><dd>{r.token_expires_at ? fmtDate(r.token_expires_at) : "—"}</dd>
                  <dt className="text-muted-foreground">Zgoda</dt><dd>{r.consent_at ? `${fmtDate(r.consent_at)} · wersja ${r.privacy_version}` : "—"}</dd>
                  <dt className="text-muted-foreground">Usunięcie danych</dt><dd>{fmtDate(r.retention_until)}</dd>
                  {r.email && <dd className="sm:col-start-2"><Button size="sm" variant="outline" onClick={() => erase(r.id)}>Usuń dane osobowe</Button></dd>}
                </dl>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
