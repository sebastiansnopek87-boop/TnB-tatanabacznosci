import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPrelaunchSignups, type PrelaunchStatus } from "@/lib/api/prelaunch";
import { fmtDate, errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/przedpremiera")({ component: PrelaunchAdmin });

const STATUS_LABEL: Record<Exclude<PrelaunchStatus, "all">, string> = {
  active: "Oczekuje",
  withdrawn: "Wycofana zgoda",
  notified: "Powiadomiono",
};

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function PrelaunchAdmin() {
  const [status, setStatus] = useState<PrelaunchStatus>("active");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-prelaunch-signups", status],
    queryFn: () => listPrelaunchSignups({ data: { status } }),
  });

  function exportCsv() {
    if (!data?.rows.length) return;
    const columns = ["first_name", "email", "status", "consent_version", "consent_given_at", "created_at", "withdrawn_at", "notified_at"] as const;
    const lines = [columns.join(","), ...data.rows.map((row) => columns.map((column) => csvCell(column === "status" ? STATUS_LABEL[row.status] : row[column])).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `lista-przedpremierowa-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Lista przedpremierowa</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        To osobna lista osób, które zgodziły się otrzymać jednorazową informację o uruchomieniu TNB. Nie są dopisywane do newslettera.
      </p>
      {data && (
        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <span>Oczekuje: <strong>{data.counts.active}</strong></span>
          <span>Wycofane zgody: <strong>{data.counts.withdrawn}</strong></span>
          <span>Powiadomiono: <strong>{data.counts.notified}</strong></span>
          <span>Łącznie: <strong>{data.total}</strong></span>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="prelaunch-status">Status</label>
          <Select value={status} onValueChange={(value) => setStatus(value as PrelaunchStatus)}>
            <SelectTrigger id="prelaunch-status" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Oczekuje</SelectItem>
              <SelectItem value="withdrawn">Wycofana zgoda</SelectItem>
              <SelectItem value="notified">Powiadomiono</SelectItem>
              <SelectItem value="all">Wszystkie</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={exportCsv} disabled={!data?.rows.length}>Eksportuj CSV ({data?.rows.length ?? 0})</Button>
      </div>
      {data && data.total > data.rows.length && <p className="mt-4 text-sm text-amber-600">Wyświetlono {data.rows.length} z {data.total} zapisów. Eksport CSV obejmuje tylko widoczne rekordy.</p>}
      <p className="mt-4 border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        Wysyłka informacji o uruchomieniu nie jest jeszcze aktywna. Najpierw trzeba skonfigurować i przetestować pocztę. Lista nie uruchamia automatycznej wysyłki.
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      <div className="mt-6 overflow-x-auto border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="border-b border-border/60">
            <th className="p-3">Imię</th><th className="p-3">E-mail</th><th className="p-3">Status</th><th className="p-3">Zapis</th><th className="p-3">Zgoda</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Ładowanie…</td></tr>}
            {data?.rows.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Brak zapisów dla wybranego statusu.</td></tr>}
            {data?.rows.map((row) => (
              <tr key={row.id} className="border-b border-border/40">
                <td className="p-3">{row.first_name}</td>
                <td className="p-3">{row.email}</td>
                <td className="p-3"><Badge variant={row.status === "active" ? "default" : "outline"}>{STATUS_LABEL[row.status]}</Badge></td>
                <td className="p-3">{fmtDate(row.created_at)}</td>
                <td className="p-3">{fmtDate(row.consent_given_at)} · {row.consent_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
