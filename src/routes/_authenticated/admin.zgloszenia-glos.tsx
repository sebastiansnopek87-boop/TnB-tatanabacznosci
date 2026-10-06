import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListSubmissions, adminUpdateSubmission } from "@/lib/voice.functions";
import { SUBMISSION_LABEL, SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/voice";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/zgloszenia-glos")({ component: Submissions });

type Row = Awaited<ReturnType<typeof adminListSubmissions>>[number];

function Submissions() {
  const listFn = useServerFn(adminListSubmissions);
  const list = useQuery({ queryKey: ["admin-voice-submissions"], queryFn: () => listFn() });
  const [filter, setFilter] = useState<"active" | SubmissionStatus | "all">("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = (list.data ?? []).filter((r) => filter === "all" || (filter === "active" ? r.status !== "archived" : r.status === filter));
  const open = list.data?.find((r) => r.id === openId) ?? null;

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold uppercase">Zgłoszenia Głosu TNB</h1>
      <p className="mt-1 text-xs text-muted-foreground">Historie przesłane z formularza „Opowiedz swoją historię”. Dane są prywatne; notatki widzą tylko administratorzy.</p>
      <div className="mt-6">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-60" aria-label="Filtr statusu"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Bez archiwum</SelectItem>
            {SUBMISSION_STATUSES.map((s) => <SelectItem key={s} value={s}>{SUBMISSION_LABEL[s]}</SelectItem>)}
            <SelectItem value="all">Wszystkie</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-2">
          {list.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p>
            : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p>
            : !rows.length ? <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak zgłoszeń.</p>
            : rows.map((r) => (
              <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className={`block w-full border p-3 text-left ${openId === r.id ? "border-gold" : "border-border/60 hover:border-gold/60"}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{r.name}</span><Badge variant={r.status === "new" ? "default" : "outline"}>{SUBMISSION_LABEL[r.status]}</Badge></div>
                <p className="mt-1 line-clamp-1 text-sm text-foreground/75">{r.topic}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
              </button>
            ))}
        </div>
        {open ? <Detail key={open.id + open.updated_at} r={open} /> : <p className="hidden border border-border/60 p-6 text-sm text-muted-foreground lg:block">Wybierz zgłoszenie z listy.</p>}
      </div>
    </div>
  );
}

function Detail({ r }: { r: Row }) {
  const upFn = useServerFn(adminUpdateSubmission);
  const qc = useQueryClient();
  const [status, setStatus] = useState<SubmissionStatus>(r.status);
  const [note, setNote] = useState(r.admin_note);
  useEffect(() => { setStatus(r.status); setNote(r.admin_note); }, [r]);
  const save = useMutation({
    mutationFn: (v: { status: SubmissionStatus; admin_note: string }) => upFn({ data: { id: r.id, ...v } }),
    onSuccess: () => { toast.success("Zapisano."); qc.invalidateQueries({ queryKey: ["admin-voice-submissions"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const Row2 = ({ l, v }: { l: string; v: string | null }) => v ? <div><p className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">{l}</p><p className="mt-1 whitespace-pre-line break-words text-sm">{v}</p></div> : null;
  return (
    <div className="space-y-4 border border-border/60 p-4 sm:p-5">
      <h2 className="font-display text-xl font-semibold uppercase">{r.name}</h2>
      <Row2 l="E-mail" v={r.email} /><Row2 l="Telefon" v={r.phone} /><Row2 l="Kim jest" v={r.about} />
      <Row2 l="Temat rozmowy" v={r.topic} /><Row2 l="Historia" v={r.story} /><Row2 l="Dlaczego powinna wybrzmieć" v={r.why} />
      <Row2 l="Profil / strona" v={r.profile_url} /><Row2 l="Wysłano" v={fmtDate(r.created_at)} />
      <div className="space-y-2 border-t border-border/60 pt-4">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as SubmissionStatus)}>
          <SelectTrigger className="w-60" aria-label="Status zgłoszenia"><SelectValue /></SelectTrigger>
          <SelectContent>{SUBMISSION_STATUSES.map((s) => <SelectItem key={s} value={s}>{SUBMISSION_LABEL[s]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label htmlFor="note">Prywatna notatka (tylko dla administratorów)</Label><Textarea id="note" rows={4} maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate({ status, admin_note: note })}>Zapisz</Button>
        {r.status !== "archived" && <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ status: "archived", admin_note: note })}>Zarchiwizuj</Button>}
      </div>
    </div>
  );
}
