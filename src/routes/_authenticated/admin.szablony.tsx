import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getNotificationOverview, getTemplate, previewTemplate, resetTemplate, saveTemplate, sendTestMessage } from "@/lib/notifications.functions";
import { EVENTS, MODULE_LABEL, VARIABLES } from "@/lib/notify/registry";
import { errMsg } from "@/components/admin/format";
import { MailPreview } from "@/components/admin/MailPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/szablony")({
  head: () => ({ meta: [{ title: "Szablony wiadomości — Panel TNB" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Templates,
});

type Draft = { subject: string; html: string; text: string };

function Templates() {
  const overview = useServerFn(getNotificationOverview);
  const get = useServerFn(getTemplate);
  const prev = useServerFn(previewTemplate);
  const save = useServerFn(saveTemplate);
  const reset = useServerFn(resetTemplate);
  const test = useServerFn(sendTestMessage);
  const qc = useQueryClient();
  const [key, setKey] = useState(EVENTS[0]!.key);
  const ov = useQuery({ queryKey: ["admin-notif-overview"], queryFn: () => overview() });
  const tq = useQuery({ queryKey: ["admin-template", key], queryFn: () => get({ data: { key } }) });
  const [d, setD] = useState<Draft | null>(null);
  const [pv, setPv] = useState<Awaited<ReturnType<typeof prev>> | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = !!ov.data?.canEdit;

  useEffect(() => { if (tq.data) { setD({ subject: tq.data.subject, html: tq.data.html, text: tq.data.text }); setPv(null); } }, [tq.data]);
  useEffect(() => {
    if (!d) return;
    const t = setTimeout(() => { prev({ data: { key, ...d } }).then(setPv).catch(() => setPv(null)); }, 400);
    return () => clearTimeout(t);
  }, [d, key, prev]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["admin-template", key] }); qc.invalidateQueries({ queryKey: ["admin-notif-overview"] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function onTest() {
    setBusy(true);
    try {
      const r = await test({ data: { key, to } });
      if (r.status === "simulated") toast.success("Tryb testowy: wiadomość przechwycona i zapisana w Historii wysyłek jako symulacja. Nie została wysłana.");
      else if (r.status === "sent") toast.success("Wiadomość testowa wysłana.");
      else toast.error(`Nie wysłano: ${r.reason ?? r.status}`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  const ev = EVENTS.find((e) => e.key === key)!;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold uppercase">Szablony wiadomości</h1>
      {!canEdit && ov.data && <p className="text-sm text-muted-foreground">Podgląd. Edytować szablony może tylko superadministrator.</p>}
      <div className="max-w-md space-y-2">
        <Label>Szablon</Label>
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger aria-label="Szablon"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENTS.map((e) => <SelectItem key={e.key} value={e.key}>{MODULE_LABEL[e.module]} — {e.name}{ov.data?.events.find((x) => x.key === e.key)?.customized ? " (zmieniony)" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{ev.description} Odbiorca: {ev.recipient === "admin" ? "administrator" : "użytkownik"}.</p>
      </div>
      {tq.error && <p className="text-sm text-destructive">{errMsg(tq.error)}</p>}
      {d && (
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="subj">Temat</Label><Input id="subj" value={d.subject} disabled={!canEdit} onChange={(e) => setD({ ...d, subject: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="html">Treść HTML (wstawiana w szablon graficzny TNB)</Label><Textarea id="html" rows={10} className="font-mono text-xs" value={d.html} disabled={!canEdit} onChange={(e) => setD({ ...d, html: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="txt">Wersja tekstowa</Label><Textarea id="txt" rows={8} className="font-mono text-xs" value={d.text} disabled={!canEdit} onChange={(e) => setD({ ...d, text: e.target.value })} /></div>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Dostępne zmienne</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{VARIABLES.map((v) => <li key={v.key}><code>{`{{${v.key}}}`}</code> — {v.label}</li>)}</ul>
              <p className="mt-2">Brak wartości wymaganej zmiennej blokuje wysyłkę — wiadomość nigdy nie zawiera surowego znacznika.</p>
            </details>
            {canEdit && (
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy} onClick={() => run(() => save({ data: { key, ...d } }), "Szablon zapisany.")}>Zapisz zmiany</Button>
                <Button variant="outline" disabled={busy || !tq.data?.custom} onClick={() => confirm("Przywrócić domyślną treść szablonu?") && run(() => reset({ data: { key } }), "Przywrócono domyślną treść.")}>Przywróć domyślny</Button>
              </div>
            )}
            {canEdit && (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <Label htmlFor="to">Wyślij wiadomość testową (dane przykładowe)</Label>
                <div className="flex gap-2"><Input id="to" type="email" placeholder="adres@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
                  <Button variant="outline" disabled={busy || !to} onClick={onTest}>Wyślij test</Button></div>
                <p className="text-xs text-muted-foreground">Test używa zapisanej wersji szablonu.</p>
              </div>
            )}
          </div>
          <div>
            <h2 className="mb-3 font-display text-xl uppercase">Podgląd (dane przykładowe)</h2>
            {pv?.ok ? <MailPreview mail={pv} /> : pv ? <p className="text-sm text-destructive">Nieznane lub brakujące zmienne: {pv.missing.join(", ")}</p> : <p className="text-sm text-muted-foreground">Ładowanie podglądu…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
