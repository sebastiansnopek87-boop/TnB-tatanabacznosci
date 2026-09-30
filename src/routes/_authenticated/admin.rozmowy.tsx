import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminBlockDate, adminGetAvailability, adminGetBooking, adminListBookings, adminSaveAvailability, adminUpdateBooking,
} from "@/lib/consult.functions";
import { BOOKING_STATUS, MAIL_STATUS, WEEKDAYS, fmtDate, fmtHm, type BookingStatus } from "@/lib/consult";
import { errMsg, fmtDate as fmtDT } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/rozmowy")({ component: AdminConsults });

function AdminConsults() {
  const [tab, setTab] = useState<"bookings" | "availability">("bookings");
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <Details id={open} onClose={() => setOpen(null)} />;
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold uppercase">Rozmowy 1:1</h1>
      <div className="mt-4 flex gap-2">
        <Button variant={tab === "bookings" ? "default" : "outline"} onClick={() => setTab("bookings")}>Rezerwacje</Button>
        <Button variant={tab === "availability" ? "default" : "outline"} onClick={() => setTab("availability")}>Dostępność rozmów 1:1</Button>
      </div>
      <div className="mt-6">{tab === "bookings" ? <Bookings onOpen={setOpen} /> : <Availability />}</div>
    </div>
  );
}

function Bookings({ onOpen }: { onOpen: (id: string) => void }) {
  const fn = useServerFn(adminListBookings);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today); const [to, setTo] = useState(""); const [status, setStatus] = useState("");
  const q = useQuery({ queryKey: ["admin-consults", from, to, status], queryFn: () => fn({ data: { from: from || null, to: to || null, status: status || null } }) });
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Label className="grid gap-1.5"><span>Od</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Do</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Label>
        <Label className="grid gap-1.5"><span>Status</span>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 border border-input bg-background px-2 text-sm">
            <option value="">Wszystkie</option>
            {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></Label>
      </div>
      <div className="mt-5 space-y-3">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
          : q.error ? <p className="text-sm text-destructive">{errMsg(q.error)}</p>
          : !q.data?.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak rezerwacji dla wybranych filtrów.</p>
          : q.data.map((b) => (
            <div key={b.id} className="border border-border/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-medium text-foreground"><span>{fmtDate(b.starts_at)}</span>, {fmtHm(b.starts_at)} · {b.booking_number}</p>
                  <p className="break-words text-foreground/85">{b.first_name} {b.last_name} · {b.email}{b.phone ? ` · ${b.phone}` : ""}</p>
                  <p className="break-words text-foreground/85">Temat: {b.topic}</p>
                  <p className="line-clamp-2 break-words text-muted-foreground">{b.reason}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant={b.status === "booked" ? "default" : "outline"}>{BOOKING_STATUS[b.status as BookingStatus]}</Badge>
                    <Badge variant="outline">Potwierdzenie: {MAIL_STATUS[b.confirmation_status]}</Badge>
                    {b.cancel_reason && <Badge variant="outline">Powód: {b.cancel_reason}</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onOpen(b.id)}>Szczegóły</Button>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

const EV: Record<string, string> = {
  created: "Utworzono", confirmation_sent: "Wysłano potwierdzenie", confirmation_skipped: "Potwierdzenie nie zostało wysłane",
  cancelled_user: "Anulowana przez użytkownika", cancelled_admin: "Anulowana przez organizatora", completed: "Oznaczona jako zakończona",
  no_show: "Oznaczona jako nieodbyta", link_changed: "Zmieniono link", reminder_sent: "Wysłano przypomnienie", reminder_skipped: "Przypomnienie nie zostało wysłane",
};

function Details({ id, onClose }: { id: string; onClose: () => void }) {
  const getFn = useServerFn(adminGetBooking); const updFn = useServerFn(adminUpdateBooking);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-consult", id], queryFn: () => getFn({ data: { id } }) });
  const [link, setLink] = useState(""); const [reason, setReason] = useState("");
  useEffect(() => { if (q.data) setLink(q.data.booking.meeting_link ?? ""); }, [q.data]);
  const upd = useMutation({
    mutationFn: (action: "cancel" | "completed" | "no_show" | "set_link") => updFn({ data: { id, action, link, reason } }),
    onSuccess: () => { toast.success("Zapisano."); qc.invalidateQueries({ queryKey: ["admin-consult", id] }); qc.invalidateQueries({ queryKey: ["admin-consults"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>;
  const b = q.data.booking;
  const row = (k: string, v: React.ReactNode) => <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{k}</dt><dd className="mt-1 whitespace-pre-line break-words text-foreground">{v || "—"}</dd></div>;
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Rezerwacja {b.booking_number}</h1>
        <Button variant="outline" onClick={onClose}>← Wróć</Button>
      </div>
      <dl className="grid gap-4 border border-border/60 p-5 text-sm sm:grid-cols-2">
        {row("Termin", <span>{fmtDate(b.starts_at)}, {fmtHm(b.starts_at)}–{fmtHm(b.ends_at)}</span>)}
        {row("Status", BOOKING_STATUS[b.status as BookingStatus])}
        {row("Imię i nazwisko", `${b.first_name} ${b.last_name}`)}
        {row("E-mail", b.email)}
        {row("Telefon", b.phone)}
        {row("Konto", b.user_id ? "Zalogowany użytkownik" : "Bez konta")}
        {row("Potwierdzenie e-mail", `${MAIL_STATUS[b.confirmation_status]}${b.confirmation_error ? ` (${b.confirmation_error})` : ""}`)}
        {row("Przypomnienie", MAIL_STATUS[b.reminder_status])}
        <div className="sm:col-span-2">{row("Temat rozmowy", b.topic)}</div>
        <div className="sm:col-span-2">{row("Co skłoniło do rozmowy", b.reason)}</div>
        <div className="sm:col-span-2">{row("Zagadnienie / pytanie", b.question)}</div>
        {b.cancel_reason && <div className="sm:col-span-2">{row("Powód anulowania", `${b.cancel_reason} (${fmtDT(b.cancelled_at)})`)}</div>}
      </dl>
      <div className="space-y-2">
        <Label>Link do spotkania</Label>
        <div className="flex flex-wrap gap-2"><Input className="max-w-md" value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} /><Button variant="outline" disabled={upd.isPending} onClick={() => upd.mutate("set_link")}>Zapisz link</Button></div>
      </div>
      {b.status === "booked" && (
        <div className="space-y-2 border-t border-border/60 pt-5">
          <Label>Powód / notatka (opcjonalnie)</Label>
          <Input value={reason} maxLength={400} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={upd.isPending} onClick={() => upd.mutate("completed")}>Oznacz jako zakończoną</Button>
            <Button variant="outline" disabled={upd.isPending} onClick={() => upd.mutate("no_show")}>Oznacz jako nieodbytą</Button>
            <Button variant="outline" disabled={upd.isPending} onClick={() => { if (confirm("Anulować tę rezerwację?")) upd.mutate("cancel"); }}>Anuluj rezerwację</Button>
          </div>
        </div>
      )}
      <div className="border-t border-border/60 pt-5">
        <h2 className="font-display text-xl font-semibold uppercase">Historia</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {q.data.events.map((e, i) => <li key={i} className="text-foreground/85">{fmtDT(e.created_at)} — {EV[e.type] ?? e.type}{e.detail ? `: ${e.detail}` : ""}</li>)}
        </ul>
      </div>
    </div>
  );
}

type Iv = { weekday: number; start_time: string; end_time: string; active: boolean };

function Availability() {
  const getFn = useServerFn(adminGetAvailability); const saveFn = useServerFn(adminSaveAvailability); const blockFn = useServerFn(adminBlockDate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-consult-availability"], queryFn: () => getFn() });
  const [ivs, setIvs] = useState<Iv[]>([]); const [link, setLink] = useState("");
  const [bDay, setBDay] = useState(""); const [bReason, setBReason] = useState("");
  useEffect(() => { if (q.data) { setIvs(q.data.intervals.map((i) => ({ weekday: i.weekday, start_time: i.start_time.slice(0, 5), end_time: i.end_time.slice(0, 5), active: i.active }))); setLink(q.data.defaultLink); } }, [q.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-consult-availability"] }); qc.invalidateQueries({ queryKey: ["consult-slots"] }); };
  const save = useMutation({ mutationFn: () => saveFn({ data: { intervals: ivs, defaultLink: link } }), onSuccess: () => { toast.success("Dostępność zapisana."); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  const block = useMutation({ mutationFn: (v: { day: string; remove?: boolean }) => blockFn({ data: { day: v.day, reason: bReason, remove: !!v.remove } }), onSuccess: () => { toast.success("Zapisano."); setBDay(""); setBReason(""); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  const upd = (i: number, p: Partial<Iv>) => setIvs((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">Ustaw godziny przyjmowania rezerwacji (czas polski). Rozmowy trwają 30 minut; terminy są generowane co 30 minut w każdym przedziale. Rezerwacja jest możliwa najpóźniej 2 godziny przed terminem, maksymalnie 60 dni do przodu.</p>
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const rows = ivs.map((x, i) => ({ x, i })).filter(({ x }) => x.weekday === wd);
          const dayOn = rows.some(({ x }) => x.active);
          return (
            <div key={wd} className="border border-border/60 p-3" data-testid={`wd-${wd}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{WEEKDAYS[wd]}</p>
                <div className="flex items-center gap-3">
                  {rows.length > 0 && <label className="flex items-center gap-2 text-xs text-muted-foreground">Dzień włączony <Switch aria-label={`${WEEKDAYS[wd]} włączony`} checked={dayOn} onCheckedChange={(v) => setIvs((a) => a.map((x) => (x.weekday === wd ? { ...x, active: v } : x)))} /></label>}
                  <Button size="sm" variant="outline" onClick={() => setIvs((a) => [...a, { weekday: wd, start_time: "10:00", end_time: "12:00", active: true }])}>+ Przedział</Button>
                </div>
              </div>
              {rows.map(({ x, i }) => (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                  <Input type="time" aria-label="Od" className="w-32" value={x.start_time} onChange={(e) => upd(i, { start_time: e.target.value })} />
                  <span>–</span>
                  <Input type="time" aria-label="Do" className="w-32" value={x.end_time} onChange={(e) => upd(i, { end_time: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => setIvs((a) => a.filter((_, j) => j !== i))}>Usuń</Button>
                </div>
              ))}
            </div>
          );
        })}
        <Label className="grid max-w-md gap-1.5"><span>Domyślny link do spotkania (przypisywany nowym rezerwacjom)</span><Input value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} /></Label>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Zapisywanie…" : "Zapisz dostępność"}</Button>
      </section>
      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="font-display text-xl font-semibold uppercase">Zablokowane daty</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Label className="grid gap-1.5"><span>Data</span><Input type="date" value={bDay} onChange={(e) => setBDay(e.target.value)} /></Label>
          <Label className="grid gap-1.5"><span>Powód (opcjonalnie)</span><Input value={bReason} maxLength={200} onChange={(e) => setBReason(e.target.value)} /></Label>
          <Button disabled={!bDay || block.isPending} onClick={() => block.mutate({ day: bDay })}>Zablokuj datę</Button>
        </div>
        {!q.data?.blocked.length ? <p className="text-sm text-muted-foreground">Brak zablokowanych dat.</p> : (
          <ul className="space-y-2">
            {q.data.blocked.map((b) => (
              <li key={b.day} className="flex flex-wrap items-center justify-between gap-2 border border-border/60 p-2 text-sm">
                <span>{b.day}{b.reason ? ` — ${b.reason}` : ""}</span>
                <Button size="sm" variant="outline" onClick={() => block.mutate({ day: b.day, remove: true })}>Odblokuj</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
