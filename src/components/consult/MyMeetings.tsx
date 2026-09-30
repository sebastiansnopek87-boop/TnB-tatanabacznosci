import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { cancelMyBooking, listMyBookings } from "@/lib/consult.functions";
import { BOOKING_STATUS, CANCEL_REASONS, canUserCancel, fmtDate, fmtHm, type BookingStatus } from "@/lib/consult";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function MyMeetings() {
  const fn = useServerFn(listMyBookings);
  const q = useQuery({ queryKey: ["my-consults"], queryFn: () => fn() });
  const [cancelId, setCancelId] = useState<string | null>(null);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <p className="text-sm text-destructive">Nie udało się wczytać spotkań.</p>;
  const now = Date.now();
  const upcoming = (q.data ?? []).filter((b) => b.status === "booked" && new Date(b.ends_at).getTime() > now).reverse();
  const past = (q.data ?? []).filter((b) => !upcoming.includes(b));
  return (
    <div className="space-y-6">
      {!upcoming.length ? (
        <p className="text-sm leading-relaxed text-muted-foreground">Nie masz zaplanowanych rozmów 1:1. <Link to="/spotkania/rozmowa-1-1" className="text-gold underline">Umów rozmowę</Link>.</p>
      ) : (
        <ul className="space-y-4">
          {upcoming.map((b) => {
            const can = canUserCancel(b.starts_at);
            return (
              <li key={b.id} className="border border-border/60 p-4" data-testid="my-consult">
                <p className="text-xs uppercase tracking-[0.12em] text-gold">Rozmowa 1:1 · {b.booking_number}</p>
                <p className="mt-2 text-foreground"><span>{fmtDate(b.starts_at)}</span>, {fmtHm(b.starts_at)}–{fmtHm(b.ends_at)}</p>
                <p className="mt-1 break-words text-sm text-foreground/80">Temat: {b.topic}</p>
                <p className="mt-1 text-sm text-foreground/80">Status: {BOOKING_STATUS[b.status as BookingStatus]}</p>
                <p className="mt-1 break-all text-sm">{b.meeting_link ? <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="text-gold underline">Dołącz do spotkania</a> : <span className="text-muted-foreground">Link do spotkania pojawi się przed rozmową.</span>}</p>
                <div className="mt-3">
                  <Button size="sm" variant="outline" disabled={!can} onClick={() => setCancelId(b.id)}>Anuluj spotkanie</Button>
                  {!can && <p className="mt-2 text-xs text-muted-foreground">Do rozmowy zostało mniej niż 2 godziny — termin możesz odwołać wyłącznie przez <Link to="/kontakt" className="text-gold underline">kontakt z organizatorem</Link>.</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {past.length > 0 && (
        <div>
          <p className="eyebrow text-muted-foreground">Historia</p>
          <ul className="mt-2 space-y-2">
            {past.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-2 text-sm last:border-0">
                <span className="text-foreground/85">{fmtDate(b.starts_at)}, {fmtHm(b.starts_at)}</span>
                <span className="text-muted-foreground">{BOOKING_STATUS[b.status as BookingStatus]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CancelDialog id={cancelId} onClose={() => setCancelId(null)} />
    </div>
  );
}

function CancelDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const fn = useServerFn(cancelMyBooking);
  const qc = useQueryClient();
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number] | null>(null);
  const [other, setOther] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: id!, reason: reason!, other } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-consults"] }); qc.invalidateQueries({ queryKey: ["consult-slots"] }); setReason(null); setOther(""); onClose(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Nie udało się anulować."),
  });
  function confirm() {
    setErr(null);
    if (!reason) return setErr("Wybierz powód anulowania.");
    if (reason === "Inny powód" && other.trim().length < 3) return setErr("Wpisz krótkie wyjaśnienie.");
    m.mutate();
  }
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) { setErr(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anulować spotkanie?</DialogTitle>
          <DialogDescription>Termin zostanie zwolniony. Wybierz powód anulowania.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-3 text-sm">
              <input type="radio" name="cancel-reason" className="accent-[var(--color-gold)]" checked={reason === r} onChange={() => setReason(r)} />
              {r === "Inny powód" ? "Inny powód" : r}
            </label>
          ))}
          {reason === "Inny powód" && <textarea aria-label="Wyjaśnienie" value={other} maxLength={400} onChange={(e) => setOther(e.target.value)} className="mt-2 min-h-20 w-full border border-border bg-background p-2 text-sm" placeholder="Krótkie wyjaśnienie" />}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Nie, wróć</Button>
          <Button disabled={m.isPending} onClick={confirm}>{m.isPending ? "Anulowanie…" : "Tak, anuluj spotkanie"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
