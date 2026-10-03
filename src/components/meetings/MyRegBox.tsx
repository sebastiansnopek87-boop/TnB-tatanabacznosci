import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { cancelMyRegistration } from "@/lib/meetings.functions";
import { REG_STATUS, countdown, endOf, fmtTime, type RegStatus } from "@/lib/meetings";

const btn = "bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60";

/** Participant's own status: countdown, join button (only when the server returns a link), recording, private location, withdrawal. */
export function MyRegBox({ m, reg, onChange }: { m: { kind: string; starts_at: string; ends_at: string | null }; reg: import("@/lib/meetings").MyReg; onChange: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const opensAt = reg.joinOpensAt ? new Date(reg.joinOpensAt).getTime() : null;
  useEffect(() => { if (opensAt && now >= opensAt) onChange(); }, [opensAt, now >= (opensAt ?? Infinity)]); // refetch to receive link
  const cancelFn = useServerFn(cancelMyRegistration);
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { token: reg.token } }),
    onSuccess: (r) => { if ("error" in r) { alert(r.error); return; } qc.invalidateQueries({ queryKey: ["meetings"] }); qc.invalidateQueries({ queryKey: ["my-meeting-regs"] }); onChange(); },
  });
  const ended = endOf(m) < now;
  const started = new Date(m.starts_at).getTime() <= now;
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold uppercase text-foreground">Twoje zgłoszenie</h2>
      <p className="mt-3 text-sm text-foreground/80">Status: <span className="text-gold">{ended && reg.status === "approved" ? "Zakończone" : REG_STATUS[reg.status as RegStatus]}</span></p>
      {reg.status === "pending" && <p className="mt-2 text-sm text-foreground/70">Organizator jeszcze nie zatwierdził Twojego udziału.</p>}
      {reg.status === "approved" && m.kind === "online" && !ended && (
        reg.link ? <a href={reg.link} target="_blank" rel="noopener noreferrer" className={`${btn} mt-5 inline-block`}>Dołącz do spotkania</a>
        : opensAt ? <p className="mt-3 text-sm text-foreground/80">{started ? "Spotkanie trwa." : `Start za ${countdown(new Date(m.starts_at).getTime() - now)}.`} Przycisk „Dołącz do spotkania” pojawi się {fmtTime(new Date(opensAt).toISOString())}.</p>
        : <p className="mt-3 text-sm text-foreground/70">Organizator nie dodał jeszcze pokoju spotkania. Przycisk dołączenia pojawi się tutaj, gdy link będzie gotowy.</p>
      )}
      {reg.status === "approved" && m.kind === "live" && (reg.address || reg.meeting_point) && (
        <div className="mt-4 text-sm text-foreground/85">
          {reg.address && <p>Adres: {reg.address}</p>}
          {reg.meeting_point && <p className="mt-1">Punkt zbiórki: {reg.meeting_point}</p>}
          {reg.map_url && <a href={reg.map_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-gold underline">Pokaż na mapie</a>}
        </div>
      )}
      {reg.recording && <a href={reg.recording} target="_blank" rel="noopener noreferrer" className={`${btn} mt-5 inline-block`}>Odtwórz nagranie</a>}
      {reg.canCancel && (
        <button type="button" disabled={cancel.isPending} onClick={() => { if (confirm("Czy na pewno chcesz zrezygnować z udziału?")) cancel.mutate(); }}
          className="mt-5 block text-xs uppercase tracking-[0.14em] text-foreground/60 underline hover:text-destructive">Zrezygnuj z udziału</button>
      )}
    </div>
  );
}
