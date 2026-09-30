import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { listMedia, getMediaDetail, createMediaUpload, finalizeMediaUpload, deleteMedia } from "@/lib/media.functions";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/multimedia")({
  head: () => ({ meta: [{ title: "Multimedia — Centrum dowodzenia TNB" }, { name: "robots", content: "noindex" }] }),
  component: MediaPage,
});

const MODULES: Record<string, string> = { library: "Biblioteka", podcast: "Podcast", meetings: "Spotkania", pages: "Strony", unknown: "Nieustalone" };
const KINDS: Record<string, string> = { image: "Obraz", audio: "Audio", document: "Dokument", other: "Inny" };
const STATUS: Record<string, string> = { published: "opublikowane", draft: "szkic", archived: "archiwum" };
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.mp3,.m4a,.aac,.ogg,.wav,.webm,.pdf,.mp4";
export const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;

function uploadWithProgress(bucket: string, path: string, token: string, file: File, onProgress: (p: number) => void) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("content-type", file.type);
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(x.status === 413 ? "Plik jest za duży." : "Nie udało się przesłać pliku.")));
    x.onerror = () => reject(new Error("Brak połączenia z serwerem. Spróbuj ponownie."));
    x.send(file);
  });
}

function MediaPage() {
  const fn = useServerFn(listMedia);
  const startFn = useServerFn(createMediaUpload);
  const finFn = useServerFn(finalizeMediaUpload);
  const qc = useQueryClient();
  const [q, setQ] = useState(""); const [applied, setApplied] = useState("");
  const [kind, setKind] = useState(""); const [mod, setMod] = useState(""); const [sort, setSort] = useState("date_desc"); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<{ bucket: string; path: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, error } = useQuery({
    queryKey: ["admin-media", applied, kind, mod, sort, page],
    queryFn: () => fn({ data: { q: applied, kind: kind as never, module: mod as never, sort: sort as never, page } }),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function onUpload(file: File) {
    setProgress(0);
    try {
      const t = await startFn({ data: { name: file.name, type: file.type, size: file.size } });
      await uploadWithProgress(t.bucket, t.path, t.token, file, setProgress);
      await finFn({ data: { path: t.path } });
      toast.success("Plik dodany.");
      setPage(0); setMod(""); setSort("date_desc");
      qc.invalidateQueries({ queryKey: ["admin-media"] });
    } catch (e) { toast.error(errMsg(e)); }
    finally { setProgress(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold uppercase">Multimedia</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wszystkie pliki z Biblioteki, Podcastu, Spotkań, Stron oraz pliki dodane tutaj.</p>
        </div>
        <div className="flex items-center gap-3">
          {progress !== null && <span className="text-sm text-muted-foreground" aria-live="polite">Przesyłanie… {progress}%</span>}
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" aria-label="Wybierz plik" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
          <Button onClick={() => fileRef.current?.click()} disabled={progress !== null}>Dodaj plik</Button>
        </div>
      </div>
      {progress !== null && <div className="h-1 w-full bg-border"><div className="h-1 bg-gold transition-all" style={{ width: `${progress}%` }} /></div>}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(q); }}>
        <Input className="max-w-xs" placeholder="Nazwa pliku lub materiału" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj" />
        <select className={sel} value={kind} onChange={(e) => { setPage(0); setKind(e.target.value); }} aria-label="Rodzaj pliku">
          <option value="">Wszystkie rodzaje</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={sel} value={mod} onChange={(e) => { setPage(0); setMod(e.target.value); }} aria-label="Moduł">
          <option value="">Wszystkie moduły</option>{Object.entries(MODULES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={sel} value={sort} onChange={(e) => { setPage(0); setSort(e.target.value); }} aria-label="Sortowanie">
          <option value="date_desc">Najnowsze</option><option value="date_asc">Najstarsze</option><option value="name_asc">Nazwa A–Z</option><option value="name_desc">Nazwa Z–A</option>
        </select>
        <Button type="submit" variant="outline">Szukaj</Button>
      </form>
      {error && <p className="text-sm text-destructive">{errMsg(error)}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
      {data && (data.rows.length === 0
        ? <p className="border border-border/60 p-4 text-sm text-muted-foreground">Brak plików spełniających kryteria.</p>
        : <div className="divide-y divide-border/60 border border-border/60">
            {data.rows.map((r) => (
              <button key={`${r.bucket}/${r.path}`} type="button" onClick={() => setOpen({ bucket: r.bucket, path: r.path })} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left text-sm hover:bg-foreground/5">
                <span className="min-w-0 flex-1 basis-full truncate font-medium sm:basis-auto">{r.file}</span>
                <span className="text-xs text-muted-foreground">{KINDS[r.kind]} · {r.format} · {fmtSize(r.size)}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                <span className="text-xs text-gold">{MODULES[r.module]}</span>
                <span className="text-xs text-foreground/70">{r.usages.length ? r.usages.map((u) => u.title).join(", ") : "Brak powiązań"}</span>
              </button>
            ))}
          </div>)}
      {data && (
        <div className="flex items-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Poprzednia</Button>
          <span className="text-muted-foreground">Strona {page + 1} z {pages} · {data.total} plików</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Następna</Button>
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {open && <Detail target={open} onDeleted={() => { setOpen(null); qc.invalidateQueries({ queryKey: ["admin-media"] }); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ target, onDeleted }: { target: { bucket: string; path: string }; onDeleted: () => void }) {
  const fn = useServerFn(getMediaDetail);
  const delFn = useServerFn(deleteMedia);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const { data: d, error } = useQuery({ queryKey: ["admin-media-detail", target.bucket, target.path], queryFn: () => fn({ data: target as never }), staleTime: 0 });
  async function del() {
    setBusy(true);
    try { await delFn({ data: target as never }); toast.success("Plik usunięty."); onDeleted(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); setConfirm(false); }
  }
  return (
    <>
      <DialogHeader><DialogTitle className="break-all">{d?.file ?? "Plik"}</DialogTitle></DialogHeader>
      {error && <p className="text-sm text-destructive">{errMsg(error)}</p>}
      {!d && !error && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
      {d && (
        <div className="space-y-4 text-sm">
          {d.preview && d.kind === "image" && <img src={d.preview} alt={d.file} className="max-h-72 w-auto border border-border/60" />}
          {d.preview && d.kind === "audio" && <audio controls src={d.preview} className="w-full" />}
          {d.preview && d.mime.startsWith("video/") && <video controls src={d.preview} className="max-h-72 w-full" />}
          {d.preview && d.mime === "application/pdf" && <a href={d.preview} target="_blank" rel="noreferrer" className="text-gold underline">Otwórz podgląd PDF (link ważny 10 minut)</a>}
          {!d.preview && <p className="text-muted-foreground">Podgląd niedostępny dla tego formatu.</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Typ</dt><dd>{KINDS[d.kind]} · {d.format} {d.mime && `(${d.mime})`}</dd>
            <dt className="text-muted-foreground">Rozmiar</dt><dd>{fmtSize(d.size)}</dd>
            <dt className="text-muted-foreground">Dodano</dt><dd>{fmtDate(d.created_at)}</dd>
            <dt className="text-muted-foreground">Moduł</dt><dd>{MODULES[d.module]}</dd>
            <dt className="text-muted-foreground">Dostępność</dt><dd>{d.usages.some((u) => u.published) ? "Publiczny przez opublikowany materiał" : "Prywatny (tylko panel administratora)"}</dd>
          </dl>
          <div>
            <p className="mb-1 font-medium">Powiązania</p>
            {d.usages.length === 0 ? <p className="text-muted-foreground">Brak powiązań z treściami.</p> : (
              <ul className="space-y-1">{d.usages.map((u, i) => (
                <li key={i}>{MODULES[u.module]} — {u.label}: <span className="font-medium">{u.title}</span> <span className={u.published ? "text-gold" : "text-muted-foreground"}>({STATUS[u.status] ?? u.status})</span></li>
              ))}</ul>
            )}
          </div>
          {d.deletable
            ? <Button variant="destructive" disabled={busy} onClick={() => setConfirm(true)}>Usuń plik</Button>
            : <p className="text-muted-foreground">Usunięcie zablokowane — plik jest używany w treściach wymienionych powyżej.</p>}
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Usunąć plik?</AlertDialogTitle>
            <AlertDialogDescription>Plik „{d?.file}” zostanie trwale usunięty z magazynu. Tej operacji nie można cofnąć.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Anuluj</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); void del(); }} disabled={busy}>Usuń</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
