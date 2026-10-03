import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminCancelMeeting, adminGetMeeting, adminListMeetings, adminListRegistrations, adminRemoveMeetingImage, adminSaveMeeting,
  adminSetMeetingStatus, adminUpdateRegistration, adminUploadMeetingImage,
} from "@/lib/meetings.functions";
import { DIFFICULTY, MEETING_KINDS, MEETING_STATUS, REG_STATUS, type MeetingKind, type MeetingStatus, type RegStatus } from "@/lib/meetings";
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
  const cancelFn = useServerFn(adminCancelMeeting);
  const cancel = useMutation({
    mutationFn: (v: { id: string; reason: string }) => cancelFn({ data: v }),
    onSuccess: (r) => { toast.success(`Spotkanie odwołane. Anulowane zgłoszenia: ${r.affected}.`); qc.invalidateQueries({ queryKey: ["admin-meetings"] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
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
                    {m.cancelled_at && <Badge variant="destructive">Odwołane</Badge>}
                    {m.kind === "live" && m.is_outdoor && <Badge variant="outline">W terenie</Badge>}
                    {m.kind === "online" && !m.online_link && !m.cancelled_at && <Badge variant="outline">Brak linku do webinaru</Badge>}
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
                  {!m.cancelled_at && <Button size="sm" variant="destructive" disabled={cancel.isPending} onClick={() => {
                    const reason = window.prompt("Powód odwołania (zobaczą go uczestnicy):"); if (reason) cancel.mutate({ id: m.id, reason });
                  }}>Odwołaj</Button>}
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
  host: string; venue_name: string; address: string; map_url: string; equipment: string; fee_info: string; organizer_contact: string; cancellation_policy: string;
  is_outdoor: boolean; route_length: string; route_duration: string; difficulty: "" | "latwa" | "srednia" | "trudna"; meeting_point: string; preparation: string; org_notes: string;
  join_open_minutes: string; user_can_cancel: boolean; recording_url: string; recording_access: "participants" | "public";
};
const EMPTY: Form = { title: "", slug: "", kind: "online", summary: "", description: "", rules: "", starts: "", ends: "", location: "", location_public: false, capacity: "", registration_open: false, requires_login: false, requires_approval: true, online_link: "",
  host: "", venue_name: "", address: "", map_url: "", equipment: "", fee_info: "", organizer_contact: "", cancellation_policy: "", is_outdoor: false, route_length: "", route_duration: "",
  difficulty: "", meeting_point: "", preparation: "", org_notes: "", join_open_minutes: "15", user_can_cancel: true, recording_url: "", recording_access: "participants" };
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
      requires_login: m.requires_login, requires_approval: m.requires_approval, online_link: m.online_link ?? "",
      host: m.host, venue_name: m.venue_name, address: m.address, map_url: m.map_url ?? "", equipment: m.equipment, fee_info: m.fee_info, organizer_contact: m.organizer_contact,
      cancellation_policy: m.cancellation_policy, is_outdoor: m.is_outdoor, route_length: m.route_length, route_duration: m.route_duration, difficulty: m.difficulty as Form["difficulty"],
      meeting_point: m.meeting_point, preparation: m.preparation, org_notes: m.org_notes, join_open_minutes: String(m.join_open_minutes), user_can_cancel: m.user_can_cancel,
      recording_url: m.recording_url ?? "", recording_access: m.recording_access as Form["recording_access"] });
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
        host: f.host, venue_name: f.venue_name, address: f.address, map_url: f.map_url, equipment: f.equipment, fee_info: f.fee_info, organizer_contact: f.organizer_contact,
        cancellation_policy: f.cancellation_policy, is_outdoor: f.is_outdoor, route_length: f.route_length, route_duration: f.route_duration, difficulty: f.difficulty,
        meeting_point: f.meeting_point, preparation: f.preparation, org_notes: f.org_notes, join_open_minutes: Math.max(0, Math.min(240, Number(f.join_open_minutes) || 0)),
        user_can_cancel: f.user_can_cancel, recording_url: f.recording_url, recording_access: f.recording_access,
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
  const sw = (k: "location_public" | "registration_open" | "requires_login" | "requires_approval" | "is_outdoor" | "user_can_cancel", label: string) => (
    <label className="flex items-center justify-between gap-3 border border-border/60 p-3 text-sm"><span>{label}</span><Switch checked={f[k]} onCheckedChange={(v) => set(k, v)} /></label>
  );
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">{id ? "Edycja spotkania" : "Nowe spotkanie"}</h1>
        <Button variant="outline" onClick={onClose}>← Wróć do listy</Button>
      </div>
      {cur.data && <p className="text-xs text-muted-foreground">Status: {MEETING_STATUS[cur.data.status as MeetingStatus]} · publikację zmienisz na liście spotkań.</p>}
      <Label className="grid gap-1.5"><span>Tytuł *</span><Input value={f.title} maxLength={200} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} /></Label>
      <Label className="grid gap-1.5"><span>Adres (/spotkania/…) *</span><Input value={f.slug} maxLength={120} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} /></Label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label>Rodzaj</Label>
          <Select value={f.kind} onValueChange={(v) => set("kind", v as MeetingKind)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(MEETING_KINDS) as MeetingKind[]).map((k) => <SelectItem key={k} value={k}>{MEETING_KINDS[k]}</SelectItem>)}</SelectContent></Select></div>
        <Label className="grid gap-1.5"><span>Rozpoczęcie *</span><Input type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Zakończenie</span><Input type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5"><span>Krótki opis</span><Textarea value={f.summary} maxLength={600} onChange={(e) => set("summary", e.target.value)} /></Label>
      <Label className="grid gap-1.5"><span>Pełny opis (akapity oddziel pustą linią)</span><Textarea className="min-h-40" value={f.description} maxLength={20000} onChange={(e) => set("description", e.target.value)} /></Label>
      <Label className="grid gap-1.5"><span>Zasady uczestnictwa</span><Textarea value={f.rules} maxLength={5000} onChange={(e) => set("rules", e.target.value)} /></Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="grid gap-1.5"><span>Prowadzący</span><Input value={f.host} maxLength={200} onChange={(e) => set("host", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Limit uczestników (puste = bez limitu)</span><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Opłata (puste = bezpłatne)</span><Input value={f.fee_info} maxLength={500} onChange={(e) => set("fee_info", e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Kontakt do organizatora</span><Input value={f.organizer_contact} maxLength={300} onChange={(e) => set("organizer_contact", e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5"><span>Zasady rezygnacji z udziału</span><Textarea value={f.cancellation_policy} maxLength={2000} onChange={(e) => set("cancellation_policy", e.target.value)} /></Label>
      {f.kind === "online" ? (
        <fieldset className="space-y-4 border border-border/60 p-4">
          <legend className="px-2 text-sm font-medium">Webinar online</legend>
          <div className="grid gap-1.5">
            <Label>Link do pokoju webinaru (Zoom, Google Meet, Jitsi…) — widoczny tylko dla zatwierdzonych uczestników w oknie dołączania</Label>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap"><Input value={f.online_link} maxLength={500} placeholder="https://" onChange={(e) => set("online_link", e.target.value)} />
              <Button type="button" variant="outline" onClick={() => set("online_link", `https://meet.jit.si/TNB-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`)}>Utwórz pokój Jitsi</Button></div>
            {!f.online_link && <p className="text-xs text-muted-foreground">Bez linku uczestnicy nie zobaczą przycisku „Dołącz do spotkania”.</p>}
          </div>
          <Label className="grid gap-1.5"><span>Przycisk „Dołącz” pojawia się (minut przed startem)</span><Input type="number" min={0} max={240} value={f.join_open_minutes} onChange={(e) => set("join_open_minutes", e.target.value)} /></Label>
          <Label className="grid gap-1.5"><span>Nagranie po zakończeniu (link https)</span><Input value={f.recording_url} maxLength={500} placeholder="https://" onChange={(e) => set("recording_url", e.target.value)} /></Label>
          <div><Label>Kto może odtworzyć nagranie</Label>
            <Select value={f.recording_access} onValueChange={(v) => set("recording_access", v as Form["recording_access"])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="participants">Tylko zatwierdzeni uczestnicy</SelectItem><SelectItem value="public">Wszyscy odwiedzający</SelectItem></SelectContent></Select></div>
        </fieldset>
      ) : (
        <fieldset className="space-y-4 border border-border/60 p-4">
          <legend className="px-2 text-sm font-medium">Spotkanie LIVE</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="grid gap-1.5"><span>Nazwa miejsca</span><Input value={f.venue_name} maxLength={200} onChange={(e) => set("venue_name", e.target.value)} /></Label>
            <Label className="grid gap-1.5"><span>Miasto / okolica (krótko)</span><Input value={f.location} maxLength={300} onChange={(e) => set("location", e.target.value)} /></Label>
          </div>
          <Label className="grid gap-1.5"><span>Pełny adres</span><Input value={f.address} maxLength={400} onChange={(e) => set("address", e.target.value)} /></Label>
          <Label className="grid gap-1.5"><span>Link do mapy (np. Google Maps)</span><Input value={f.map_url} maxLength={500} placeholder="https://" onChange={(e) => set("map_url", e.target.value)} /></Label>
          <Label className="grid gap-1.5"><span>Potrzebne wyposażenie</span><Textarea value={f.equipment} maxLength={2000} onChange={(e) => set("equipment", e.target.value)} /></Label>
          {sw("is_outdoor", "Spotkanie w terenie (trasa górska, leśna, aktywność)")}
          {f.is_outdoor && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Label className="grid gap-1.5"><span>Długość trasy</span><Input value={f.route_length} maxLength={100} placeholder="np. 12 km" onChange={(e) => set("route_length", e.target.value)} /></Label>
                <Label className="grid gap-1.5"><span>Czas przejścia</span><Input value={f.route_duration} maxLength={100} placeholder="np. ok. 4 godz." onChange={(e) => set("route_duration", e.target.value)} /></Label>
                <div><Label>Poziom trudności</Label>
                  <Select value={f.difficulty || "none"} onValueChange={(v) => set("difficulty", (v === "none" ? "" : v) as Form["difficulty"])}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nie określono</SelectItem>{Object.entries(DIFFICULTY).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Label className="grid gap-1.5"><span>Punkt zbiórki</span><Input value={f.meeting_point} maxLength={400} onChange={(e) => set("meeting_point", e.target.value)} /></Label>
              <Label className="grid gap-1.5"><span>Wymagane przygotowanie</span><Textarea value={f.preparation} maxLength={2000} onChange={(e) => set("preparation", e.target.value)} /></Label>
              <Label className="grid gap-1.5"><span>Dodatkowe uwagi organizacyjne</span><Textarea value={f.org_notes} maxLength={2000} onChange={(e) => set("org_notes", e.target.value)} /></Label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Gdy lokalizacja nie jest publiczna, adres, punkt zbiórki i mapę zobaczą tylko zatwierdzeni uczestnicy.</p>
        </fieldset>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {f.kind === "live" && sw("location_public", "Pokaż adres i punkt zbiórki publicznie")}
        {sw("registration_open", "Zapisy włączone")}
        {sw("requires_login", "Zapisy tylko dla zalogowanych")}
        {sw("requires_approval", "Zgłoszenia wymagają zatwierdzenia")}
        {sw("user_can_cancel", "Uczestnik może sam zrezygnować przed startem")}
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
