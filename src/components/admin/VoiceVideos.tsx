import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeleteVideo, adminListVideos, adminSaveVideo, adminSetVideoStatus } from "@/lib/voice.functions";
import { VIDEO_STATUS, ytThumb, ytUrl } from "@/lib/voice";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Row = Awaited<ReturnType<typeof adminListVideos>>[number];
type F = { id: string | null; url: string; title: string; description: string; published_on: string; thumbnail_url: string; sort_order: string };
const EMPTY: F = { id: null, url: "", title: "", description: "", published_on: "", thumbnail_url: "", sort_order: "0" };

export function VoiceVideos() {
  const listFn = useServerFn(adminListVideos); const saveFn = useServerFn(adminSaveVideo);
  const stFn = useServerFn(adminSetVideoStatus); const delFn = useServerFn(adminDeleteVideo);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-voice-videos"], queryFn: () => listFn() });
  const [f, setF] = useState<F | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-voice-videos"] }); qc.invalidateQueries({ queryKey: ["voice-videos"] }); };
  const save = useMutation({
    mutationFn: (v: F) => saveFn({ data: { id: v.id, url: v.url, title: v.title, description: v.description, published_on: v.published_on || null, thumbnail_url: v.thumbnail_url, sort_order: Number(v.sort_order || 0) } }),
    onSuccess: () => { toast.success("Zapisano materiał."); setF(null); refresh(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const st = useMutation({ mutationFn: (v: { id: string; status: Row["status"] }) => stFn({ data: v }), onSuccess: (_r, v) => { toast.success(`Status: ${VIDEO_STATUS[v.status]}`); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => { toast.success("Usunięto."); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  const set = <K extends keyof F>(k: K, v: string) => setF((p) => (p ? { ...p, [k]: v } : p));

  return (
    <section className="mt-12 border-t border-border/60 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold uppercase">Materiały YouTube („Oglądaj”)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Dodawane ręcznie — brak automatycznej synchronizacji z YouTube. Strona pokazuje tylko odnośnik i miniaturę; film zostaje na YouTube.</p>
        </div>
        {!f && <Button onClick={() => setF(EMPTY)}>+ Dodaj film</Button>}
      </div>

      {f && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(f); }} className="mt-6 space-y-4 border border-border/60 p-4">
          <div className="space-y-2"><Label htmlFor="vu">Adres filmu YouTube *</Label><Input id="vu" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></div>
          <div className="space-y-2"><Label htmlFor="vt">Tytuł *</Label><Input id="vt" value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="vd">Krótki opis</Label><Textarea id="vd" rows={3} maxLength={1000} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="vp">Data</Label><Input id="vp" type="date" value={f.published_on} onChange={(e) => set("published_on", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="vo">Kolejność</Label><Input id="vo" type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="vm">Własna miniatura (opcjonalnie)</Label><Input id="vm" value={f.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://…" /></div>
          </div>
          <p className="text-xs text-muted-foreground">Bez własnej miniatury używana jest miniatura z YouTube. Nowy film zapisuje się jako szkic.</p>
          <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Zapisywanie…" : "Zapisz"}</Button><Button type="button" variant="outline" onClick={() => setF(null)}>Anuluj</Button></div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !list.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak materiałów wideo.</p>
          : list.data.map((v) => (
            <div key={v.id} className="flex flex-col gap-3 border border-border/60 p-4 sm:flex-row sm:items-center">
              <img src={v.thumbnail_url || ytThumb(v.youtube_id)} alt="" className="aspect-video w-full max-w-[200px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{v.title}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Badge variant={v.status === "published" ? "default" : "outline"}>{VIDEO_STATUS[v.status]}</Badge>{v.published_on && <Badge variant="outline">{v.published_on}</Badge>}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setF({ id: v.id, url: ytUrl(v.youtube_id), title: v.title, description: v.description, published_on: v.published_on ?? "", thumbnail_url: v.thumbnail_url ?? "", sort_order: String(v.sort_order) })}>Edytuj</Button>
                {v.status !== "published" ? <Button size="sm" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "published" })}>Opublikuj</Button>
                  : <Button size="sm" variant="outline" disabled={st.isPending} onClick={() => st.mutate({ id: v.id, status: "hidden" })}>Ukryj</Button>}
                <Button size="sm" variant="outline" disabled={del.isPending} onClick={() => { if (window.confirm("Usunąć ten materiał z Głosu TNB? Film na YouTube pozostaje bez zmian.")) del.mutate(v.id); }}>Usuń</Button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
