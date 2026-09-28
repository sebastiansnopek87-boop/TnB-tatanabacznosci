import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listNotificationLog } from "@/lib/admin.functions";
import { fmtDate, LOG_KIND, LOG_REASON, LOG_STATUS } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/powiadomienia")({ component: Log });

type Kind = "all" | "contact_message" | "newsletter_signup";
type St = "all" | "sent" | "skipped" | "failed" | "suppressed";

function Log() {
  const list = useServerFn(listNotificationLog);
  const [kind, setKind] = useState<Kind>("all");
  const [status, setStatus] = useState<St>("all");
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-log", kind, status], queryFn: () => list({ data: { kind, status } }) });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Historia powiadomień</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-56" aria-label="Rodzaj"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie rodzaje</SelectItem>
            <SelectItem value="contact_message">Wiadomość z Kontaktu</SelectItem>
            <SelectItem value="newsletter_signup">Zapis do newslettera</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as St)}>
          <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="sent">Wysłano</SelectItem>
            <SelectItem value="skipped">Pominięto</SelectItem>
            <SelectItem value="failed">Błąd</SelectItem>
            <SelectItem value="suppressed">Zablokowano</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>}
      <div className="mt-6 overflow-x-auto border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="border-b border-border/60">
            <th className="p-3">Data</th><th className="p-3">Rodzaj</th><th className="p-3">Status</th><th className="p-3">Przyczyna</th><th className="p-3">Odbiorca</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Ładowanie…</td></tr>}
            {data?.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Brak wpisów.</td></tr>}
            {data?.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="p-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="p-3">{LOG_KIND[r.kind] ?? r.kind}</td>
                <td className="p-3"><Badge variant={r.status === "failed" ? "destructive" : "outline"}>{LOG_STATUS[r.status] ?? r.status}</Badge></td>
                <td className="p-3">{r.reason ? (LOG_REASON[r.reason] ?? r.reason) : "—"}</td>
                <td className="p-3">{r.recipient ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
