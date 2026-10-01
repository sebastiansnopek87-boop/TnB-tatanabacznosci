import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listNotificationLog } from "@/lib/admin.functions";
import { getLogPreview, retryNotification } from "@/lib/notifications.functions";
import { EVENTS } from "@/lib/notify/registry";
import { fmtDate, LOG_STATUS, logReason, errMsg } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MailPreviewDialog } from "@/components/admin/MailPreview";

export const Route = createFileRoute("/_authenticated/admin/powiadomienia")({ component: Log });

const EV_NAME = Object.fromEntries(EVENTS.map((e) => [e.key, e.name]));
type St = "all" | "pending" | "sending" | "sent" | "delivered" | "failed" | "cancelled" | "skipped" | "suppressed" | "simulated";

function Log() {
  const list = useServerFn(listNotificationLog);
  const retry = useServerFn(retryNotification);
  const preview = useServerFn(getLogPreview);
  const qc = useQueryClient();
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState<St>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [pv, setPv] = useState<{ subject: string; html: string; text: string } | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-log", kind, status], queryFn: () => list({ data: { kind, status } }) });

  async function onRetry(id: string) {
    setBusy(id);
    try {
      const r = await retry({ data: { id } });
      toast[r.status === "failed" ? "error" : "success"](r.status === "simulated" ? "Ponowiono w trybie testowym — wiadomość przechwycona, nie wysłana." : r.status === "sent" ? "Wysłano ponownie." : `Ponowienie nieudane: ${logReason(r.reason ?? null)}`);
      qc.invalidateQueries({ queryKey: ["admin-log"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }
  async function onPreview(id: string) {
    try {
      const r = await preview({ data: { id } });
      if (!r.rendered_html) { toast.error("Brak zapisanego podglądu."); return; }
      setPv({ subject: r.rendered_subject ?? "", html: r.rendered_html, text: r.rendered_text ?? "" });
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Historia wysyłek</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">„Symulacja” oznacza wiadomość przechwyconą w trybie testowym — nie została wysłana do odbiorcy. „Wysłano” oznacza przyjęcie przez dostawcę, nie potwierdzenie dostarczenia.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-72" aria-label="Zdarzenie"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie zdarzenia</SelectItem>
            {EVENTS.map((e) => <SelectItem key={e.key} value={e.key}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as St)}>
          <SelectTrigger className="w-56" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {Object.entries(LOG_STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      <div className="mt-6 overflow-x-auto border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="border-b border-border/60">
            <th className="p-3">Data</th><th className="p-3">Zdarzenie / szablon</th><th className="p-3">Status</th><th className="p-3">Przyczyna</th><th className="p-3">Odbiorca</th><th className="p-3">Próby</th><th className="p-3">Id dostawcy</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={8}>Ładowanie…</td></tr>}
            {data?.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={8}>Brak wpisów.</td></tr>}
            {data?.map((r) => (
              <tr key={r.id} className="border-b border-border/40 align-top">
                <td className="p-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="p-3">{EV_NAME[r.kind] ?? r.kind}</td>
                <td className="p-3"><Badge variant={r.status === "failed" ? "destructive" : r.status === "simulated" ? "secondary" : "outline"}>{LOG_STATUS[r.status] ?? r.status}</Badge></td>
                <td className="p-3">{logReason(r.reason)}</td>
                <td className="p-3 break-all">{r.recipient ?? "—"}</td>
                <td className="p-3">{r.attempts}</td>
                <td className="p-3 break-all text-xs">{r.provider_message_id ?? "—"}</td>
                <td className="p-3 whitespace-nowrap space-x-2">
                  {r.status === "simulated" && <Button size="sm" variant="outline" onClick={() => onPreview(r.id)}>Podgląd</Button>}
                  {r.status === "failed" && (r.retryable
                    ? <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => onRetry(r.id)}>{busy === r.id ? "Ponawianie…" : "Ponów"}</Button>
                    : <span className="text-xs text-muted-foreground">Nie do ponowienia (poufny link)</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MailPreviewDialog value={pv} onClose={() => setPv(null)} title="Przechwycona wiadomość (symulacja)" />
    </div>
  );
}
