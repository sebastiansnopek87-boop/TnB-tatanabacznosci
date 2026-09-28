import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSubscribers } from "@/lib/admin.functions";
import { fmtDate, SUB_STATUS , errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/subskrybenci")({ component: Subscribers });

type St = "all" | "pending" | "active" | "unsubscribed";
type Filters = { status: St; q: string; from: string; to: string };

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV formula-injection guard
  return `"${safe.replace(/"/g, '""')}"`;
}

function Subscribers() {
  const list = useServerFn(listSubscribers);
  const [draft, setDraft] = useState<Filters>({ status: "all", q: "", from: "", to: "" });
  const [f, setF] = useState<Filters>(draft);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-subs", f], queryFn: () => list({ data: f }) });
  const open = data?.find((r) => r.id === openId);

  function exportCsv() {
    if (!data?.length) return;
    const cols = ["email", "status", "source", "opt_in_method", "consent_version", "consent_given_at", "confirmed_at", "unsubscribed_at", "subscribe_count", "created_at"] as const;
    const lines = [cols.join(","), ...data.map((r) => cols.map((c) => csvCell(c === "status" ? SUB_STATUS[r.status] : r[c])).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `subskrybenci-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Subskrybenci newslettera</h1>
      <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setF(draft); }}>
        <div className="space-y-1"><Label>Status</Label>
          <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as St })}>
            <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="active">Aktywny</SelectItem>
              <SelectItem value="pending">Oczekuje</SelectItem>
              <SelectItem value="unsubscribed">Wypisany</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label htmlFor="sq">E-mail</Label><Input id="sq" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} className="w-56" /></div>
        <div className="space-y-1"><Label htmlFor="sf">Zapis od</Label><Input id="sf" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="st">Zapis do</Label><Input id="st" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></div>
        <Button type="submit" variant="outline">Filtruj</Button>
        <Button type="button" onClick={exportCsv} disabled={!data?.length}>Eksportuj CSV ({data?.length ?? 0})</Button>
      </form>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      <div className="mt-6 overflow-x-auto border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="border-b border-border/60">
            <th className="p-3">E-mail</th><th className="p-3">Status</th><th className="p-3">Zapis</th><th className="p-3">Potwierdzenie</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Ładowanie…</td></tr>}
            {data?.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Brak subskrybentów dla wybranych filtrów.</td></tr>}
            {data?.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="p-3">{r.email}</td>
                <td className="p-3"><Badge variant={r.status === "active" ? "default" : "outline"}>{SUB_STATUS[r.status]}</Badge></td>
                <td className="p-3">{fmtDate(r.created_at)}</td>
                <td className="p-3">{fmtDate(r.confirmed_at)}</td>
                <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>Szczegóły</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open?.email}</DialogTitle></DialogHeader>
          {open && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt><dd>{SUB_STATUS[open.status]}</dd>
              <dt className="text-muted-foreground">Źródło</dt><dd>{open.source}</dd>
              <dt className="text-muted-foreground">Metoda zapisu</dt><dd>{open.opt_in_method === "double" ? "Z potwierdzeniem e-mail" : "Jednoetapowa"}</dd>
              <dt className="text-muted-foreground">Pierwszy zapis</dt><dd>{fmtDate(open.created_at)}</dd>
              <dt className="text-muted-foreground">Zgoda udzielona</dt><dd>{fmtDate(open.consent_given_at)}</dd>
              <dt className="text-muted-foreground">Wersja zgody</dt><dd>{open.consent_version}</dd>
              <dt className="text-muted-foreground">Potwierdzono</dt><dd>{fmtDate(open.confirmed_at)}</dd>
              <dt className="text-muted-foreground">Wypisano</dt><dd>{fmtDate(open.unsubscribed_at)}</dd>
              <dt className="text-muted-foreground">Liczba zapisów</dt><dd>{open.subscribe_count}</dd>
              <dt className="text-muted-foreground">Treść zgody</dt><dd className="italic">{open.consent_text}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
