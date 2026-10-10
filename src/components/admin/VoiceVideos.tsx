import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminAddManualVideo, adminGetYoutubeSource, adminListVideos, adminSaveYoutubeSource, adminSetVideoStatus, adminSyncIfStale, adminSyncYoutube, adminUpdateVideo, type AdminVideo } from "@/lib/voice.functions";
import { VIDEO_STATUS, ytThumb } from "@/lib/voice";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { YoutubeDiagnostics } from "@/components/admin/YoutubeDiagnostics";
import { YoutubeKeyField } from "@/components/admin/YoutubeKeyField";

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "—");

type SyncReport = { at?: string; fetched?: number; added?: number; updated?: number; skipped?: number; kept_custom?: number; errors?: string[]; fatal?: string } | null;

export function VoiceVideos() {
  const srcFn = useServerFn(adminGetYoutubeSource); const saveFn = useServerFn(adminSaveYoutubeSource);
  const syncFn = useServerFn(adminSyncYoutube); const staleFn = useServerFn(adminSyncIfStale);
  const listFn = useServerFn(adminListVideos); const stFn = useServerFn(adminSetVideoStatus);
  const qc = useQueryClient();
  const src = useQuery({ queryKey: ["admin-yt-source"], queryFn: () => srcFn() });
  const list = useQuery({ queryKey: ["admin-voice-videos"], queryFn: () => listFn() });
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<AdminVideo | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (src.data?.channel_input && !input) setInput(src.data.channel_input); }, [src.data?.channel_input]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => ["admin-yt-source", "admin-voice-videos", "voice-videos", "voice-channel"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  // sync-on-admin-entry (only when older than 30 min)
  useEffect(() => { if (src.data?.keyConfigured && src.data.uploads_playlist) staleFn().then(refresh).catch(() => {}); }, [src.data?.keyConfigured, src.data?.uploads_playlist]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({ mutationFn: () => saveFn({ data: { input } }), onSuccess: (c) => { toast.success(`Znaleziono kanał: ${c.channel_title}`); refresh(); }, onError: (e) => { toast.error(errMsg(e)); refresh(); } });
  const sync = useMutation({ mutationFn: () => syncFn(), onSuccess: (r) => { toast.success(`Synchronizacja: nowe ${r.added}, zaktualizowane ${r.updated}, bez zmian ${r.skipped}, zachowane ręczne poprawki ${r.keptCustom}.`); refresh(); }, onError: (e) => { toast.error(errMsg(e)); refresh(); } });
  const st = useMutation({ mutationFn: (v: { id: string; status: "draft" | "published" | "hidden" | "archived" }) => stFn({ data: v }), onSuccess: () => refresh(), onError: (e) => toast.error(errMsg(e)) });
  const s = src.data;
  const report = (s?.last_sync_report ?? null) as SyncReport;
  const items = list.data ?? [];
  const active = items.filter((v) => !v.archived_at);
  const archived = items.filter((v) => v.archived_at);

  return (
    <section className="mt-12 border-t border-border/60 pt-8">
      <h2 className="font-display text-2xl font-semibold uppercase">Źródło YouTube — Głos TNB</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Filmy pobierają się automatycznie z jednego, oficjalnego kanału (lista przesłanych filmów). Synchronizacja uruchamia się sama, gdy dane są starsze niż 30 minut — przy wejściu na stronę Głosu TNB albo do tego panelu — oraz przyciskiem „Synchronizuj teraz”. Pliki wideo nie są kopiowane. Twoje ręczne poprawki tytułu i opisu przetrwają synchronizację.</p>

      {s && !s.keyConfigured && (
        <div className="mt-4 border border-destructive/60 p-4 text-sm">
          <p className="font-semibold text-destructive">Brak klucza YouTube Data API.</p>
          <p className="mt-1 text-muted-foreground">Wymagany sekret: <code>YOUTUBE_API_KEY</code> (klucz API z Google Cloud z włączonym „YouTube Data API v3”). Dodaje się go w ustawieniach sekretów projektu. Bez niego kanału nie da się sprawdzić ani zsynchronizować.</p>
        </div>
      )}

      <YoutubeKeyField masked={s?.keyMasked} source={s?.keySource} onChanged={refresh} />

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-6 space-y-2">
        <Label htmlFor="ytc">Kanał YouTube (adres, @handle albo Channel ID)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="ytc" value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://www.youtube.com/@nazwa-kanalu" />
          <Button type="submit" disabled={save.isPending || !input.trim()}>{save.isPending ? "Sprawdzanie…" : "Zapisz i sprawdź połączenie"}</Button>
        </div>
      </form>

      {s && (
        <div className="mt-6 flex flex-col gap-4 border border-border/60 p-4 sm:flex-row sm:items-center">
          {s.channel_thumb && <img src={s.channel_thumb} alt="" className="h-16 w-16 rounded-full object-cover" />}
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="font-medium">{s.channel_title ?? "Kanał nie został jeszcze skonfigurowany"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={s.status === "ok" ? "default" : s.status === "error" ? "destructive" : "outline"}>{s.status === "ok" ? "Połączono" : s.status === "error" ? "Błąd" : "Nie skonfigurowano"}</Badge>
              <Badge variant="outline">Materiały: {s.video_count}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Ostatnia synchronizacja: {dt(s.last_sync_at)}{s.last_sync_at && ` (nowe ${s.last_sync_added}, zaktualizowane ${s.last_sync_updated}, bez zmian ${s.last_sync_skipped ?? 0})`}</p>
            {s.last_error && <p className="break-words text-xs text-destructive">{s.last_error}</p>}
            <YoutubeDiagnostics error={s.status === "error" ? (s.last_error ?? null) : null} keyConfigured={s.keyConfigured} keyCheck={s.keyCheck} />
            {s.channel_url && <a href={s.channel_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold underline">{s.channel_url}</a>}
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending || !s.uploads_playlist || !s.keyConfigured}>{sync.isPending ? "Synchronizacja…" : "Synchronizuj teraz"}</Button>
        </div>
      )}

      {report && (
        <div className="mt-4 border border-border/60 p-4 text-sm">
          <p className="font-medium">Raport ostatniej synchronizacji <span className="text-xs text-muted-foreground">({dt(report.at ?? null)})</span></p>
          {report.fatal ? <p className="mt-2 break-words text-xs text-destructive">Synchronizacja przerwana: {report.fatal}</p> : (
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <li>Pobrano z YouTube: <b className="text-foreground">{report.fetched ?? 0}</b></li>
              <li>Nowe materiały: <b className="text-foreground">{report.added ?? 0}</b></li>
              <li>Zaktualizowane: <b className="text-foreground">{report.updated ?? 0}</b></li>
              <li>Bez zmian: <b className="text-foreground">{report.skipped ?? 0}</b></li>
              <li>Zachowane ręczne poprawki: <b className="text-foreground">{report.kept_custom ?? 0}</b></li>
              <li>Błędy zapisu: <b className={report.errors?.length ? "text-destructive" : "text-foreground"}>{report.errors?.length ?? 0}</b></li>
            </ul>
          )}
          {!!report.errors?.length && <ul className="mt-2 space-y-1 text-xs text-destructive">{report.errors.map((e, i) => <li key={i} className="break-words">{e}</li>)}</ul>}
        </div>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold uppercase">Materiały wideo i linki</h3>
          <p className="text-xs text-muted-foreground">Kliknij „Edytuj”, aby zmienić tytuł, opis, miniaturę, kategorię, wyróżnienie lub kolejność. Przy filmach z YouTube Twoja wersja tytułu/opisu przetrwa synchronizację — możesz ją też przywrócić do wersji z YouTube.</p>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}>Dodaj materiał ręcznie</Button>
      </div>

      <div className="mt-4 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !active.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak materiałów — skonfiguruj kanał i uruchom synchronizację albo dodaj materiał ręcznie.</p>
          : active.map((v) => (
            <div key={v.id} className="flex flex-col gap-3 border border-border/60 p-3 sm:flex-row sm:items-center">
              <img src={v.custom_thumbnail_url || v.thumbnail_url || (v.youtube_id ? ytThumb(v.youtube_id) : "")} alt="" className="aspect-video w-full max-w-[160px] bg-surface-deep object-cover" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{v.title}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant={v.status === "published" ? "default" : "outline"}>{VIDEO_STATUS[v.status]}</Badge>
                  {v.published_on && <Badge variant="outline">{v.published_on}</Badge>}
                  {v.source === "manual" && <Badge variant="outline">{v.external_url ? "link zewnętrzny" : "dodany ręcznie"}</Badge>}
                  {v.featured && <Badge variant="outline">wyróżniony</Badge>}
                  {v.category && <Badge variant="outline">{v.category}</Badge>}
                  {(v.is_custom_title || v.is_custom_description) && <Badge variant="outline">ręczne poprawki</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(v)}>Edytuj</Button>
                {v.status !== "published" ? <Button size="sm" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "published" })}>Pokaż</Button>
                  : <Button size="sm" variant="outline" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "hidden" })}>Ukryj</Button>}
                <Button size="sm" variant="outline" disabled={st.isPending} onClick={() => { if (window.confirm("Przenieść materiał do archiwum? Zniknie ze strony, ale zostanie w panelu.")) st.mutate({ id: v.id, status: "archived" }); }}>Archiwizuj</Button>
              </div>
            </div>
          ))}
      </div>

      {!!archived.length && (
        <div className="mt-8">
          <h4 className="font-display text-sm font-semibold uppercase text-muted-foreground">Archiwum ({archived.length})</h4>
          <div className="mt-3 space-y-2">
            {archived.map((v) => (
              <div key={v.id} className="flex flex-col gap-2 border border-border/40 p-3 opacity-70 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 break-words text-sm">{v.title} <span className="text-xs text-muted-foreground">· zarchiwizowany {dt(v.archived_at)}</span></p>
                <Button size="sm" variant="outline" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "hidden" })}>Przywróć z archiwum</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <EditDialog video={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      <AddDialog open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />
    </section>
  );
}

function EditDialog({ video, onClose, onSaved }: { video: AdminVideo | null; onClose: () => void; onSaved: () => void }) {
  const updFn = useServerFn(adminUpdateVideo);
  const [f, setF] = useState({ title: "", description: "", custom_thumbnail_url: "", category: "", featured: false, sort_order: 0, published_on: "", reset_title: false, reset_description: false });
  useEffect(() => {
    if (video) setF({ title: video.title, description: video.description, custom_thumbnail_url: video.custom_thumbnail_url ?? "", category: video.category ?? "",
      featured: video.featured, sort_order: video.sort_order, published_on: video.published_on ?? "", reset_title: false, reset_description: false });
  }, [video]);
  const save = useMutation({
    mutationFn: () => updFn({ data: { id: video!.id, ...f } }),
    onSuccess: () => { toast.success("Zapisano zmiany."); onSaved(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const yt = video?.source === "youtube";
  return (
    <Dialog open={!!video} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Edytuj materiał</DialogTitle></DialogHeader>
        {video && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-t">Tytuł</Label>
              <Input id="ev-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required />
              {yt && <p className="text-xs text-muted-foreground">{video.is_custom_title ? "Tytuł zmieniony ręcznie — synchronizacja go nie nadpisze." : "Zmiana tytułu oznaczy go jako ręczny — synchronizacja go nie nadpisze."}</p>}
            </div>
            {yt && video.is_custom_title && (
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.reset_title} onCheckedChange={(c) => setF({ ...f, reset_title: c === true })} />Przywróć tytuł z YouTube</label>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ev-d">Opis (maks. 1000 znaków)</Label>
              <textarea id="ev-d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1000} rows={5}
                className="w-full border border-border bg-surface-deep px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
              {yt && <p className="text-xs text-muted-foreground">{video.is_custom_description ? "Opis zmieniony ręcznie — synchronizacja go nie nadpisze." : "Zmiana opisu oznaczy go jako ręczny."}</p>}
            </div>
            {yt && video.is_custom_description && (
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.reset_description} onCheckedChange={(c) => setF({ ...f, reset_description: c === true })} />Przywróć opis z YouTube</label>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ev-th">Własna miniatura (adres https:// — opcjonalnie)</Label>
              <Input id="ev-th" value={f.custom_thumbnail_url} onChange={(e) => setF({ ...f, custom_thumbnail_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-c">Kategoria (opcjonalnie)</Label>
                <Input id="ev-c" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-o">Kolejność (mniejsza = wyżej)</Label>
                <Input id="ev-o" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>
            {!yt && (
              <div className="space-y-1.5">
                <Label htmlFor="ev-p">Data publikacji</Label>
                <Input id="ev-p" type="date" value={f.published_on} onChange={(e) => setF({ ...f, published_on: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.featured} onCheckedChange={(c) => setF({ ...f, featured: c === true })} />Wyróżnij materiał (wyświetla się wyżej na liście)</label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
              <Button type="submit" disabled={save.isPending || !f.title.trim()}>{save.isPending ? "Zapisywanie…" : "Zapisz"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const addFn = useServerFn(adminAddManualVideo);
  const empty = { url: "", title: "", description: "", custom_thumbnail_url: "", category: "", published_on: new Date().toISOString().slice(0, 10), status: "draft" as "draft" | "published" };
  const [f, setF] = useState(empty);
  useEffect(() => { if (open) setF(empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => addFn({ data: f }),
    onSuccess: () => { toast.success("Dodano materiał."); onSaved(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Dodaj materiał ręcznie</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="av-u">Link do materiału</Label>
            <Input id="av-u" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=… albo inny adres https://" required />
            <p className="text-xs text-muted-foreground">Film YouTube osadzi się w odtwarzaczu na stronie. Inny link (https://) otworzy się w nowej karcie. Synchronizacja nigdy nie zmienia materiałów dodanych ręcznie.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-t">Tytuł</Label>
            <Input id="av-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-d">Opis (maks. 1000 znaków)</Label>
            <textarea id="av-d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1000} rows={4}
              className="w-full border border-border bg-surface-deep px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-th">Miniatura (adres https:// — opcjonalnie)</Label>
            <Input id="av-th" value={f.custom_thumbnail_url} onChange={(e) => setF({ ...f, custom_thumbnail_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="av-c">Kategoria (opcjonalnie)</Label>
              <Input id="av-c" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-p">Data publikacji</Label>
              <Input id="av-p" type="date" value={f.published_on} onChange={(e) => setF({ ...f, published_on: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-s">Status</Label>
            <select id="av-s" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "draft" | "published" })}
              className="w-full border border-border bg-surface-deep px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none">
              <option value="draft">Szkic (niewidoczny na stronie)</option>
              <option value="published">Opublikowany</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={save.isPending || !f.title.trim() || !f.url.trim()}>{save.isPending ? "Dodawanie…" : "Dodaj"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
