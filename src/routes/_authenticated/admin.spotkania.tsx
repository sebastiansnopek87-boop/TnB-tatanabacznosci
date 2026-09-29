import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetMeeting, adminListMeetings, adminListRegistrations, adminRemoveMeetingImage, adminSaveMeeting,
  adminSetMeetingStatus, adminUpdateRegistration, adminUploadMeetingImage,
} from "@/lib/meetings.functions";
import { MEETING_KINDS, MEETING_STATUS, REG_STATUS, type MeetingKind, type MeetingStatus, type RegStatus } from "@/lib/meetings";
import { slugify } from "@/lib/library";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/spotkania")({ component: AdminMeetings });

type View = { mode: "list" } | { mode: "edit"; id: string | null } | { mode: "regs"; id: string; title: string; capacity: number | null };

function AdminMeetings() {
  const [view, setView] = useState<View>({ mode: "list" });
  if (view.mode === "edit") return <Editor id={view.id} onClose={() => setView({ mode: "list" })} onSaved={(id) => setView({ mode: "edit", id })} />;
  if (view.mode === "regs") return <Registrations {...view} onClose={() => setView({ mode: "list" })} />;
  return <List onEdit={(id) => setView({ mode: "edit", id })} onRegs={(id, title, capacity) => setView({ mode: "regs", id, title, capacity })} />;
}

function List({ onEdit, onRegs }: { onEdit: (id: string | null) => void; onRegs: (id: string, t: string, c: number | null) => void }) {
  const listFn = useServerFn(adminListMeetings);
  const statusFn = useServerFn(adminSetMeetingStatus);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-meetings"], queryFn: () => listFn() });
  const setSt = useMutation({
    mutationFn: (v: { id: string; status: MeetingStatus }) => statusFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(`Status: ${MEETING_STATUS[v.status]}`); qc.invalidateQueries({ queryKey: ["admin-meetings"] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Spotkania</h1>
        <Button onClick={() => onEdit(null)}>+ Nowe spotkanie</Button>
      </div>
      <div className="mt-6 space-y-3">
        {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
          : !list.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak spotkań. Dodaj pierwsze spotkanie.</p>
          : list.data.map((m) => {
            const occupied = m.pending + m.approved;
            return (
              <div key={m.id} className="flex flex-col gap-3 border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium text-foreground">{m.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/spotkania/{m.slug} · {MEETING_KINDS[m.kind as MeetingKind]} · {fmtDate(m.starts_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={m.status === "published" ? "default" : "outline"}>{MEETING_STATUS[m.status as MeetingStatus]}</Badge>
                    <Badge variant="outline">{m.registration_open ? "Zapisy włączone" : "Zapisy wyłączone"}</Badge>
                    <Badge variant="outline">Zgłoszenia: {m.total} (oczekuje {m.pending}, zatw. {m.approved})</Badge>
                    <Badge variant="outline">{m.capacity == null ? "Bez limitu" : `Wolne miejsca: ${Math.max(0, m.capacity - occupied)} / ${m.capacity}`}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(m.id)}>Edytuj</Button>
                  <Button size="sm" variant="outline" onClick={() => onRegs(m.id, m.title, m.capacity)}>Zgłoszenia</Button>
                  {m.status !== "published" && <Button size="sm" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: m.id, status: "published" })}>Opublikuj</Button>}
                  {m.status === "published" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: m.id, status: "draft" })}>Wycofaj publikację</Button>}
                  {m.status !== "archived" && <Button size="sm" variant="outline" disabled={setSt.isPending} onClick={() => setSt.mutate({ id: m.id, status: "archived" })}>Archiwizuj</Button>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

type Form = {
  title: string; slug: string; kind: MeetingKind; summary: string; description: string; rules: string; starts: string; ends: string;
  location: string; location_public: boolean; capacity: string; registration_open: boolean; requires_login: boolean; requires_approval: boolean; online_link: string;
};
const EMPTY: Form = { title: "", slug: "", kind: "online", summary: "", description: "", rules: "", starts: "", ends: "", location: "", location_public: false, capacity: "", registration_open: false, requires_login: false, requires_approval: true, online_link: "" };
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });

function Editor({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: (id: string) => void }) {
  const getFn = useServerFn(adminGetMeeting); const saveFn = useServerFn(adminSaveMeeting);
  const upFn = useServerFn(adminUploadMeetingImage); const rmFn = useServerFn(adminRemoveMeetingImage);
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY); const [slugTouched, setSlugTouched] = useState(!!id);
  const cur = useQuery({ queryKey: ["admin-meeting", id], queryFn: () => getFn({ data: { id: id! } }), enabled: !!id });
  useEffect(() => {
    const m = cur.data; if (!m) return;
    setF({ title: m.title, slug: m.slug, kind: m.kind as MeetingKind, summary: m.summary, description: m.description, rules: m.rules, starts: toLocal(m.starts_at), ends: toLocal(m.ends_at),
      location: m.location, location_public: m.location_public, capacity: m.capacity ? String(m.capacity) : "", registration_open: m.registration_open,
      requires_login: m.requires_login, requires_approval: m.requires_approval, online_link: m.online_link ?? "" });
  }, [cur.data]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      if (!f.starts) throw new Error("Podaj datę i godzinę rozpoczęcia.");
      const cap = f.capacity.trim() ? Number(f.capacity) : null;
      if (cap !== null && (!Number.isInteger(cap) || cap < 1)) throw new Error("Limit uczestników musi być liczbą całkowitą większą od zera.");
      return saveFn({ data: {
        id, slug: f.slug, title: f.title, kind: f.kind, summary: f.summary, description: f.description, rules: f.rules,
        starts_at: new Date(f.starts).toISOString(), ends_at: f.ends ? new Date(f.ends).toISOString() : null,
        location: f.location, location_public: f.location_public, capacity: cap, registration_open: f.registration_open,
        requires_login: f.requires_login, requires_approval: f.requires_approval, online_link: f.online_link,
      } });
    },
    onSuccess: (r) => { toast.success("Zapisano."); qc.invalidateQueries({ queryKey: ["admin-meetings"] }); qc.invalidateQueries({ queryKey: ["admin-meeting", r.id] }); qc.invalidateQueries({ queryKey: ["meetings"] }); onSaved(r.id); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => upFn({ data: { id: id!, name: file.name, type: file.type, base64: await toBase64(file) } }),
    onSuccess: () => { toast.success("Grafika dodana."); qc.invalidateQueries({ queryKey: ["admin-meeting", id] }); }, onError: (e) => toast.error(errMsg(e)),
  });
  const removeImg = useMutation({ mutationFn: () => rmFn({ data: { id: id! } }), onSuccess: () => { toast.success("Grafika usunięta."); qc.invalidateQueries({ queryKey: ["admin-meeting", id] }); }, onError: (e) => toast.error(errMsg(e)) });

  if (id && cur.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  const sw = (k: "location_public" | "registration_open" | "requires_login" | "requires_approval", label: string) => (
    <label className="flex items-center justify-between gap-3 border border-border/60 p-3 text-sm"><span>{label}</span><Switch checked={f[k]} onCheckedChange={(v) => set(k, v)} /></label>
  );
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">{id ? "Edycja spotkania" : "Nowe spotkanie"}</h1>
        <Button variant="outline" onClick={onClose}>← Wróć do listy</Button>
      </div>
      {cur.data && <p className="text-xs text-muted-foreground">Status: {MEETING_STATUS[cur.data.status as MeetingStatus]} · publikację zmienisz na liście spotkań.</p>}
      <div><Label>Tytuł *</Label><Input value={f.title} maxLength={200} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} /></div>
      <div><Label>Adres (/spotkania/…) *</Label><Input value={f.slug} maxLength={120} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label>Rodzaj</Label>
          <Select value={f.kind} onValueChange={(v) => set("kind", v as MeetingKind)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(MEETING_KINDS) as MeetingKind[]).map((k) => <SelectItem key={k} value={k}>{MEETING_KINDS[k]}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Rozpoczęcie *</Label><Input type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} /></div>
        <div><Label>Zakończenie</Label><Input type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} /></div>
      </div>
      <div><Label>Krótki opis</Label><Textarea value={f.summary} maxLength={600} onChange={(e) => set("summary", e.target.value)} /></div>
      <div><Label>Pełny opis (akapity oddziel pustą linią)</Label><Textarea className="min-h-40" value={f.description} maxLength={20000} onChange={(e) => set("description", e.target.value)} /></div>
      <div><Label>Zasady uczestnictwa</Label><Textarea value={f.rules} maxLength={5000} onChange={(e) => set("rules", e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Lokalizacja</Label><Input value={f.location} maxLength={300} onChange={(e) => set("location", e.target.value)} /></div>
        <div><Label>Limit uczestników (puste = bez limitu)</Label><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
      </div>
      <div><Label>Link do spotkania online (widoczny tylko dla zatwierdzonych uczestników)</Label><Input value={f.online_link} maxLength={500} placeholder="https://" onChange={(e) => set("online_link", e.target.value)} /></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sw("location_public", "Pokaż lokalizację publicznie")}
        {sw("registration_open", "Zapisy włączone")}
        {sw("requires_login", "Zapisy tylko dla zalogowanych")}
        {sw("requires_approval", "Zgłoszenia wymagają zatwierdzenia")}
      </div>
      <div className="flex gap-2"><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Zapisywanie…" : id ? "Zapisz zmiany" : "Zapisz szkic"}</Button></div>
      <div className="border-t border-border/60 pt-5">
        <Label>Grafika (JPG, PNG, WEBP, do 5 MB)</Label>
        {!id ? <p className="mt-1 text-xs text-muted-foreground">Zapisz spotkanie, aby dodać grafikę.</p> : (
          <div className="mt-2 space-y-2">
            {cur.data?.image_url && <p className="text-xs text-muted-foreground">Grafika jest dodana{cur.data.status === "draft" ? " (będzie widoczna po publikacji)" : ""}.</p>}
            <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = ""; }} />
            {cur.data?.image_url && <Button size="sm" variant="outline" disabled={removeImg.isPending} onClick={() => removeImg.mutate()}>Usuń grafikę</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

function csvCell(v: unknown) { const s = String(v ?? ""); return /[",;\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; }

function Registrations({ id, title, capacity, onClose }: { id: string; title: string; capacity: number | null; onClose: () => void }) {
  const listFn = useServerFn(adminListRegistrations); const updFn = useServerFn(adminUpdateRegistration);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-meeting-regs", id], queryFn: () => listFn({ data: { meetingId: id } }) });
  const upd = useMutation({
    mutationFn: (v: { id: string; status?: RegStatus; attended?: boolean }) => updFn({ data: v }),
    onSuccess: () => { toast.success("Zaktualizowano."); qc.invalidateQueries({ queryKey: ["admin-meeting-regs", id] }); qc.invalidateQueries({ queryKey: ["admin-meetings"] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = q.data ?? [];
  const occupied = rows.filter((r) => r.status === "pending" || r.status === "approved").length;

  function exportCsv() {
    const head = ["Imię i nazwisko", "E-mail", "Telefon", "Wiadomość", "Status", "Obecny", "Konto", "Data zgłoszenia"];
    const lines = rows.map((r) => [r.name, r.email, r.phone, r.message, REG_STATUS[r.status as RegStatus], r.attended ? "tak" : "nie", r.user_id ? "tak" : "nie", fmtDate(r.created_at)].map(csvCell).join(";"));
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `zgloszenia-${title.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="font-display text-3xl font-semibold uppercase">Zgłoszenia</h1><p className="mt-1 break-words text-sm text-muted-foreground">{title}</p></div>
        <div className="flex gap-2"><Button variant="outline" disabled={!rows.length} onClick={exportCsv}>Eksportuj CSV</Button><Button variant="outline" onClick={onClose}>← Wróć</Button></div>
      </div>
      <p className="mt-4 text-sm text-foreground/80">Zgłoszeń: {rows.length} · zajęte miejsca: {occupied}{capacity != null ? ` · wolne: ${Math.max(0, capacity - occupied)} z ${capacity}` : " · bez limitu"}</p>
      <div className="mt-4 space-y-3">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : q.error ? <p className="text-sm text-destructive">{errMsg(q.error)}</p>
          : !rows.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak zgłoszeń.</p>
          : rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 border border-border/60 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">{r.name} {r.user_id && <span className="text-xs text-muted-foreground">(konto)</span>}</p>
                <p className="break-all text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                {r.message && <p className="mt-2 whitespace-pre-line break-words text-foreground/80">{r.message}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={r.status === "approved" ? "default" : "outline"}>{REG_STATUS[r.status as RegStatus]}</Badge>
                  {r.attended && <Badge>Obecny</Badge>}
                  <span className="text-xs text-muted-foreground">zgłoszono {fmtDate(r.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status !== "approved" && <Button size="sm" disabled={upd.isPending} onClick={() => upd.mutate({ id: r.id, status: "approved" })}>Zatwierdź</Button>}
                {r.status !== "rejected" && <Button size="sm" variant="outline" disabled={upd.isPending} onClick={() => upd.mutate({ id: r.id, status: "rejected" })}>Odrzuć</Button>}
                {r.status === "approved" && <Button size="sm" variant="outline" disabled={upd.isPending} onClick={() => upd.mutate({ id: r.id, attended: !r.attended })}>{r.attended ? "Cofnij obecność" : "Oznacz jako obecny"}</Button>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
