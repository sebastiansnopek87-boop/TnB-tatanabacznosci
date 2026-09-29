import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminGetOrder, adminListOrders, adminResendDelivery } from "@/lib/orders.functions";
import { fmtDate, errMsg } from "@/components/admin/format";
import { fmtPrice } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/zamowienia")({ component: Orders });

const STATUS: Record<string, string> = { pending: "Oczekuje na płatność", paid: "Opłacone", failed: "Płatność nieudana", cancelled: "Anulowane", refunded: "Zwrot", delivered: "Materiał dostarczony" };
const DELIVERY: Record<string, string> = { not_sent: "Nie wysłano", sent: "Wysłano", failed: "Wysyłka nieudana" };
const REASON: Record<string, string> = {
  sender_domain_not_configured: "Brak skonfigurowanej domeny nadawcy e-mail — wiadomość nie została wysłana.",
  sender_not_connected: "Wysyłka e-mail nie jest jeszcze podłączona — wiadomość nie została wysłana.",
  not_paid: "Zamówienie nie jest opłacone.",
};
const EVENT: Record<string, string> = { created: "Utworzono", checkout_started: "Rozpoczęto płatność", checkout_error: "Błąd płatności", paid: "Opłacono", failed: "Płatność nieudana", cancelled: "Anulowano", refunded: "Zwrot", delivered: "Dostarczono", delivery_failed: "Wysyłka nieudana", duplicate_ignored: "Powtórzone zdarzenie pominięte", payment_attempt_failed: "Odrzucona próba płatności" };
const field = "h-10 border border-border/60 bg-background px-3 text-sm";

function Orders() {
  const list = useServerFn(adminListOrders);
  const [q, setQ] = useState(""); const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-orders", search, status, from, to], queryFn: () => list({ data: { q: search, status: status as "all", from, to } }) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase">Zamówienia</h1>
        <p className="mt-1 text-sm text-muted-foreground">Zakupy materiałów premium. Status płatności zmienia wyłącznie operator płatności.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q); }} className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nr zamówienia, e-mail lub materiał" className="h-10 max-w-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field} aria-label="Status">
          <option value="all">Wszystkie statusy</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} aria-label="Od" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} aria-label="Do" />
        <Button type="submit" variant="outline" className="h-10">Szukaj</Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p> : error ? <p className="text-sm text-destructive">{errMsg(error)}</p> : !data?.length ? (
        <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak zamówień.</p>
      ) : (
        <div className="overflow-x-auto border border-border/60">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border/60">
              <th className="p-3">Nr</th><th className="p-3">Data</th><th className="p-3">Materiał</th><th className="p-3">E-mail</th><th className="p-3">Kwota</th><th className="p-3">Status</th><th className="p-3">Dostawa</th></tr></thead>
            <tbody>{data.map((r: any) => (
              <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer border-b border-border/40 hover:bg-card ${openId === r.id ? "bg-card" : ""}`}>
                <td className="p-3 font-mono text-xs">{r.id.slice(0, 8).toUpperCase()}{r.environment === "sandbox" && <Badge variant="outline" className="ml-2">test</Badge>}</td>
                <td className="p-3">{fmtDate(r.created_at)}</td><td className="p-3">{r.library_items?.title}</td><td className="p-3">{r.buyer_email}</td>
                <td className="p-3">{fmtPrice(r.amount)}</td><td className="p-3">{r.delivered_at ? STATUS.delivered : STATUS[r.status]}</td><td className="p-3">{DELIVERY[r.delivery_status] ?? r.delivery_status}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {openId && <OrderDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(adminGetOrder); const resend = useServerFn(adminResendDelivery);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-order", id], queryFn: () => get({ data: { id } }) });
  const m = useMutation({
    mutationFn: () => resend({ data: { id } }),
    onSuccess: (r) => { r.ok ? toast.success("Materiał wysłany ponownie.") : toast.error(REASON[r.reason] ?? r.reason); qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Ładowanie szczegółów…</p>;
  const o: any = data.order;
  const row = (k: string, v: React.ReactNode) => <div className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2"><span className="text-muted-foreground">{k}</span><span className="break-all text-right">{v ?? "—"}</span></div>;
  return (
    <section className="border border-gold/40 bg-card p-5 text-sm">
      <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Zamówienie {o.id.slice(0, 8).toUpperCase()}</h2><button onClick={onClose} className="text-gold underline">Zamknij</button></div>
      <div className="mt-4 grid gap-x-8 md:grid-cols-2">
        <div>
          {row("Materiał", o.library_items?.title)}{row("Kwota", `${fmtPrice(o.amount)} (${o.currency})`)}{row("Status", STATUS[o.status])}
          {row("Środowisko", o.environment === "sandbox" ? "Testowe" : "Na żywo")}{row("Nr płatności u operatora", o.provider_ref)}
          {row("Konto", o.user_id ? "Zakup na koncie" : "Bez konta")}
        </div>
        <div>
          {row("Odbiorca", o.buyer_name)}{row("E-mail", o.buyer_email)}{row("Utworzono", fmtDate(o.created_at))}
          {row("Opłacono", o.paid_at && fmtDate(o.paid_at))}{row("Dostarczono", o.delivered_at && fmtDate(o.delivered_at))}
          {row("Dostawa", DELIVERY[o.delivery_status])}{o.delivery_error && row("Przyczyna", REASON[o.delivery_error] ?? o.delivery_error)}
        </div>
      </div>
      {o.status === "paid" && <Button onClick={() => m.mutate()} disabled={m.isPending} className="mt-4">{m.isPending ? "Wysyłanie…" : "Wyślij materiał ponownie"}</Button>}
      <h3 className="mt-6 eyebrow text-gold">Historia zdarzeń</h3>
      <ul className="mt-2 space-y-1">{data.events.map((e: any, i: number) => <li key={i}><span className="text-muted-foreground">{fmtDate(e.created_at)}</span> — {EVENT[e.type] ?? e.type}{e.detail ? `: ${e.detail}` : ""}</li>)}</ul>
      <h3 className="mt-6 eyebrow text-gold">Wiadomości e-mail</h3>
      {!data.mails.length ? <p className="mt-2 text-muted-foreground">Brak.</p> : <ul className="mt-2 space-y-1">{data.mails.map((e: any, i: number) => <li key={i}><span className="text-muted-foreground">{fmtDate(e.created_at)}</span> — {e.kind}: {e.status === "sent" ? "wysłano" : `niewysłano (${REASON[e.reason] ?? e.reason})`}</li>)}</ul>}
    </section>
  );
}
