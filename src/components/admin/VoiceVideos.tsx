import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminGetYoutubeSource, adminListVideos, adminSaveYoutubeSource, adminSetVideoStatus, adminSyncIfStale, adminSyncYoutube } from "@/lib/voice.functions";
import { VIDEO_STATUS, ytThumb } from "@/lib/voice";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { YoutubeDiagnostics } from "@/components/admin/YoutubeDiagnostics";
import { YoutubeKeyField } from "@/components/admin/YoutubeKeyField";

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function VoiceVideos() {
  const srcFn = useServerFn(adminGetYoutubeSource); const saveFn = useServerFn(adminSaveYoutubeSource);
  const syncFn = useServerFn(adminSyncYoutube); const staleFn = useServerFn(adminSyncIfStale);
  const listFn = useServerFn(adminListVideos); const stFn = useServerFn(adminSetVideoStatus);
  const qc = useQueryClient();
  const src = useQuery({ queryKey: ["admin-yt-source"], queryFn: () => srcFn() });
  const list = useQuery({ queryKey: ["admin-voice-videos"], queryFn: () => listFn() });
  const [input, setInput] = useState("");
  useEffect(() => { if (src.data?.channel_input && !input) setInput(src.data.channel_input); }, [src.data?.channel_input]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => ["admin-yt-source", "admin-voice-videos", "voice-videos", "voice-channel"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  // sync-on-admin-entry (only when older than 30 min)
  useEffect(() => { if (src.data?.keyConfigured && src.data.uploads_playlist) staleFn().then(refresh).catch(() => {}); }, [src.data?.keyConfigured, src.data?.uploads_playlist]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({ mutationFn: () => saveFn({ data: { input } }), onSuccess: (c) => { toast.success(`Znaleziono kanał: ${c.channel_title}`); refresh(); }, onError: (e) => { toast.error(errMsg(e)); refresh(); } });
  const sync = useMutation({ mutationFn: () => syncFn(), onSuccess: (r) => { toast.success(`Synchronizacja: nowe ${r.added}, zaktualizowane ${r.updated}, razem ${r.total}.`); refresh(); }, onError: (e) => { toast.error(errMsg(e)); refresh(); } });
  const st = useMutation({ mutationFn: (v: { id: string; status: "published" | "hidden" }) => stFn({ data: v }), onSuccess: () => refresh(), onError: (e) => toast.error(errMsg(e)) });
  const s = src.data;

  return (
    <section className="mt-12 border-t border-border/60 pt-8">
      <h2 className="font-display text-2xl font-semibold uppercase">Źródło YouTube — Głos TNB</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Filmy pobierają się automatycznie z jednego, oficjalnego kanału (lista przesłanych filmów). Synchronizacja uruchamia się sama, gdy dane są starsze niż 30 minut — przy wejściu na stronę Głosu TNB albo do tego panelu — oraz przyciskiem „Synchronizuj teraz”. Pliki wideo nie są kopiowane.</p>

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
            <p className="text-xs text-muted-foreground">Ostatnia synchronizacja: {dt(s.last_sync_at)}{s.last_sync_at && ` (nowe ${s.last_sync_added}, zaktualizowane ${s.last_sync_updated})`}</p>
            {s.last_error && <p className="break-words text-xs text-destructive">{s.last_error}</p>}
            <YoutubeDiagnostics error={s.status === "error" ? (s.last_error ?? null) : null} keyConfigured={s.keyConfigured} keyCheck={s.keyCheck} />
            {s.channel_url && <a href={s.channel_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold underline">{s.channel_url}</a>}
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending || !s.uploads_playlist || !s.keyConfigured}>{sync.isPending ? "Synchronizacja…" : "Synchronizuj teraz"}</Button>
        </div>
      )}

      <h3 className="mt-8 font-display text-lg font-semibold uppercase">Pobrane materiały</h3>
      <p className="text-xs text-muted-foreground">Treść (tytuł, opis, miniatura, data) pochodzi z YouTube. Tutaj możesz tylko ukryć materiał w Głosie TNB — ukrycie przetrwa kolejne synchronizacje.</p>
      <div className="mt-4 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !list.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak materiałów — skonfiguruj kanał i uruchom synchronizację.</p>
          : list.data.map((v) => (
            <div key={v.id} className="flex flex-col gap-3 border border-border/60 p-3 sm:flex-row sm:items-center">
              <img src={v.thumbnail_url || ytThumb(v.youtube_id)} alt="" className="aspect-video w-full max-w-[160px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{v.title}</p>
                <div className="mt-1 flex flex-wrap gap-2"><Badge variant={v.status === "published" ? "default" : "outline"}>{VIDEO_STATUS[v.status]}</Badge>{v.published_on && <Badge variant="outline">{v.published_on}</Badge>}{v.source === "manual" && <Badge variant="outline">dodany ręcznie (stary wpis)</Badge>}</div>
              </div>
              {v.status !== "published" ? <Button size="sm" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "published" })}>Pokaż</Button>
                : <Button size="sm" variant="outline" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "hidden" })}>Ukryj</Button>}
            </div>
          ))}
      </div>
    </section>
  );
}
