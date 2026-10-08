import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAttachFile, adminCreateUpload, adminGetEpisode, adminListEpisodes, adminPreviewAudio, adminRemoveFile,
  adminSaveEpisode, adminSetEpisodeStatus,
} from "@/lib/podcast.functions";
import { EP_ACCESS, EP_STATUS, fmtDuration, parseDuration, type EpAccess, type EpStatus } from "@/lib/podcast";
import { listCategories, slugify } from "@/lib/library";
import { errMsg, fmtDate } from "@/components/admin/format";
import { AudioPlayer } from "@/components/podcast/AudioPlayer";
import { VoiceVideos } from "@/components/admin/VoiceVideos";
import { InstagramSource } from "@/components/admin/InstagramSource";
import { PodcastLayoutPicker } from "@/components/admin/PodcastLayoutPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/podcast")({ component: AdminPodcast });

function AdminPodcast() {
  const [edit, setEdit] = useState<{ id: string | null } | null>(null);
  if (edit) return <Editor id={edit.id} onClose={() => setEdit(null)} onSaved={(id) => setEdit({ id })} />;
  return <List onEdit={(id) => setEdit({ id })} />;
}

function List({ onEdit }: { onEdit: (id: string | null) => void }) {
  const listFn = useServerFn(adminListEpisodes); const statusFn = useServerFn(adminSetEpisodeStatus);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-podcast"], queryFn: () => listFn() });
  const setSt = useMutation({
    mutationFn: (v: { id: string; status: EpStatus }) => statusFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(`Status: ${EP_STATUS[v.status]}`); qc.invalidateQueries({ queryKey: ["admin-podcast"] }); qc.invalidateQueries({ queryKey: ["podcast"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Głos TNB — odcinki podcastu</h1>
        <Button onClick={() => onEdit(null)}>+ Nowy odcinek</Button>
      </div>
      <PodcastLayoutPicker />
      <div className="mt-6 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !list.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak odcinków. Dodaj pierwszy odcinek.</p>
          : list.data.map((e) => (
            <div key={e.id} className="flex flex-col gap-3 border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground">{e.episode_number ? `${String(e.episode_number).padStart(2, "0")}. ` : ""}{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">/podcast/{e.slug} · kolejność {e.sort_order} · publikacja {fmtDate(e.published_at)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={e.status === "published" ? "default" : "outline"}>{EP_STATUS[e.status as EpStatus]}</Badge>
                  <Badge variant="outline">{EP_ACCESS[e.access as EpAccess]}</Badge>
                  {e.featured && <Badge variant="outline">Wyróżniony</Badge>}
                  <Badge variant="outline">{e.audio_path ? "Plik audio" : e.external_url ? "Adres zewnętrzny" : "Brak nagrania"}</Badge>
                  {!e.cover_path && <Badge variant="outline">Brak grafiki</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(e.id)}>Edytuj</Button>
                {e.status !== "published" && <Button size="sm" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: e.id, status: "published" })}>Opublikuj</Button>}
                {e.status === "published" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: e.id, status: "draft" })}>Wycofaj publikację</Button>}
                <a href={`/podcast/${e.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center border border-border px-3 text-xs hover:border-gold">Podgląd</a>
                {e.status !== "archived" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: e.id, status: "archived" })}>Archiwizuj</Button>}
              </div>
            </div>
          ))}
      </div>
      <VoiceVideos />
      <InstagramSource />
    </div>
  );
}

type Form = { subtitle: string; number: string; script: string; title: string; slug: string; summary: string; description: string; category: string; access: EpAccess; external_url: string; duration: string; featured: boolean; sort_order: string; published: string };
const EMPTY: Form = { subtitle: "", number: "", script: "", title: "", slug: "", summary: "", description: "", category: "ojcostwo", access: "public", external_url: "", duration: "", featured: false, sort_order: "0", published: "" };
const toLocal = (s: string | null) => { if (!s) return ""; const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function Editor({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: (id: string) => void }) {
  const getFn = useServerFn(adminGetEpisode); const saveFn = useServerFn(adminSaveEpisode);
  const upFn = useServerFn(adminCreateUpload); const attachFn = useServerFn(adminAttachFile); const rmFn = useServerFn(adminRemoveFile);
  const prevFn = useServerFn(adminPreviewAudio);
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["library-categories"], queryFn: listCategories });
  const [f, setF] = useState<Form>(EMPTY); const [slugTouched, setSlugTouched] = useState(!!id);
  const cur = useQuery({ queryKey: ["admin-episode", id], queryFn: () => getFn({ data: { id: id! } }), enabled: !!id });
  const preview = useQuery({ queryKey: ["admin-episode-audio", id, cur.data?.audio_path], queryFn: () => prevFn({ data: { id: id! } }), enabled: !!cur.data?.audio_path });
  useEffect(() => {
    const e = cur.data; if (!e) return;
    setF({ subtitle: e.subtitle ?? "", number: e.episode_number ? String(e.episode_number) : "", script: e.script ?? "", title: e.title, slug: e.slug, summary: e.summary, description: e.description, category: e.category, access: e.access, external_url: e.external_url ?? "",
      duration: fmtDuration(e.duration_seconds) ?? "", featured: e.featured, sort_order: String(e.sort_order), published: toLocal(e.published_at) });
  }, [cur.data]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-episode", id] }); qc.invalidateQueries({ queryKey: ["admin-podcast"] }); qc.invalidateQueries({ queryKey: ["podcast"] }); };

  const save = useMutation({
    mutationFn: () => {
      const dur = parseDuration(f.duration);
      if (Number.isNaN(dur)) throw new Error("Czas trwania podaj w formacie mm:ss lub gg:mm:ss.");
      const order = Number(f.sort_order || 0);
      if (!Number.isInteger(order)) throw new Error("Kolejność musi być liczbą całkowitą.");
      return saveFn({ data: {
        id, slug: f.slug, title: f.title, subtitle: f.subtitle, episode_number: f.number ? Number(f.number) : null, script: f.script, summary: f.summary, description: f.description, category: f.category, access: f.access,
        external_url: f.external_url, duration_seconds: dur, featured: f.featured, sort_order: order,
        published_at: f.published ? new Date(f.published).toISOString() : null,
      } });
    },
    onSuccess: (r) => { toast.success("Zapisano."); refresh(); qc.invalidateQueries({ queryKey: ["admin-episode", r.id] }); onSaved(r.id); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "audio" | "cover" }) => {
      const { path, token } = await upFn({ data: { id: id!, kind, type: file.type, size: file.size } });
      const { error } = await supabase.storage.from("podcast-files").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Nie udało się przesłać pliku.");
      await attachFn({ data: { id: id!, kind, path, type: file.type } });
      if (kind === "audio" && !f.duration) {
        const secs = await new Promise<number>((res) => { const a = new Audio(); a.preload = "metadata"; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = URL.createObjectURL(file); });
        if (secs && isFinite(secs)) set("duration", fmtDuration(Math.round(secs)) ?? "");
      }
      return kind;
    },
    onSuccess: (k) => { toast.success(k === "audio" ? "Plik audio dodany. Zapisz, aby utrwalić czas trwania." : "Grafika dodana."); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({ mutationFn: (kind: "audio" | "cover") => rmFn({ data: { id: id!, kind } }), onSuccess: () => { toast.success("Usunięto."); refresh(); }, onError: (e) => toast.error(errMsg(e)) });

  if (id && cur.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">{id ? "Edycja odcinka" : "Nowy odcinek"}</h1>
        <Button variant="outline" onClick={onClose}>← Wróć do listy</Button>
      </div>
      {cur.data && <p className="text-xs text-muted-foreground">Status: {EP_STATUS[cur.data.status as EpStatus]} · publikację zmienisz na liście odcinków.</p>}
      <Label className="grid gap-1.5"><span>Tytuł *</span><Input value={f.title} maxLength={200} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} /></Label>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Label className="grid gap-1.5"><span>Podtytuł</span><Input value={f.subtitle} maxLength={300} onChange={(e) => set("subtitle", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Numer</span><Input type="number" min={1} value={f.number} onChange={(e) => set("number", e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5"><span>Adres (/podcast/…) *</span><Input value={f.slug} maxLength={120} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} /></Label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label>Kategoria</Label>
          <Select value={f.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(cats.data ?? []).map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label>Dostęp</Label>
          <Select value={f.access} onValueChange={(v) => set("access", v as EpAccess)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(EP_ACCESS) as EpAccess[]).map((k) => <SelectItem key={k} value={k}>{EP_ACCESS[k]}</SelectItem>)}</SelectContent></Select></div>
        <Label className="grid gap-1.5"><span>Data publikacji</span><Input type="datetime-local" value={f.published} onChange={(e) => set("published", e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5"><span>Krótki opis</span><Textarea value={f.summary} maxLength={600} onChange={(e) => set("summary", e.target.value)} /></Label>
      <Label className="grid gap-1.5"><span>Pełny opis (akapity oddziel pustą linią)</span><Textarea className="min-h-40" value={f.description} maxLength={20000} onChange={(e) => set("description", e.target.value)} /></Label>
      <Label className="grid gap-1.5"><span>Scenariusz nagrania (widoczny tylko w panelu{f.script ? ` · ${f.script.trim().split(/\s+/).length} słów` : ""})</span><Textarea className="min-h-60" value={f.script} maxLength={100000} onChange={(e) => set("script", e.target.value)} /></Label>
      <Label className="grid gap-1.5"><span>Zewnętrzny adres nagrania (np. Spotify, YouTube lub bezpośredni plik MP3)</span><Input value={f.external_url} maxLength={1000} placeholder="https://" onChange={(e) => set("external_url", e.target.value)} /></Label>
      <div className="grid gap-4 sm:grid-cols-3">
        <Label className="grid gap-1.5"><span>Czas trwania (mm:ss)</span><Input value={f.duration} placeholder="np. 42:15" onChange={(e) => set("duration", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Kolejność (mniejsza = wyżej)</span><Input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></Label>
        <label className="flex items-center justify-between gap-3 self-end border border-border/60 p-2.5 text-sm"><span>Wyróżniony / najnowszy</span><Switch checked={f.featured} onCheckedChange={(v) => set("featured", v)} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Dostęp „Premium” otrzymują konta z uprawnieniem premium nadanym w bazie; płatności za odcinki nie są jeszcze uruchomione.</p>
      <div><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Zapisywanie…" : id ? "Zapisz zmiany" : "Zapisz szkic"}</Button></div>

      <div className="space-y-5 border-t border-border/60 pt-5">
        {!id ? <p className="text-xs text-muted-foreground">Zapisz odcinek, aby dodać grafikę i plik audio.</p> : (
          <>
            <div>
              <Label>Plik audio (MP3, M4A, AAC, OGG, WAV, do 200 MB)</Label>
              <div className="mt-2 space-y-2">
                {preview.data?.src && <AudioPlayer src={preview.data.src} title="Podgląd" />}
                <Input type="file" accept="audio/*" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ file, kind: "audio" }); e.target.value = ""; }} />
                {upload.isPending && <p className="text-xs text-muted-foreground">Przesyłanie…</p>}
                {cur.data?.audio_path && <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate("audio")}>Usuń plik audio</Button>}
              </div>
            </div>
            <div>
              <Label>Grafika okładkowa (JPG, PNG, WEBP, do 5 MB)</Label>
              <div className="mt-2 space-y-2">
                {cur.data?.cover_path && <p className="text-xs text-muted-foreground">Grafika jest dodana{cur.data.status !== "published" ? " (będzie widoczna po publikacji)" : ""}.</p>}
                <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ file, kind: "cover" }); e.target.value = ""; }} />
                {cur.data?.cover_path && <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate("cover")}>Usuń grafikę</Button>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
