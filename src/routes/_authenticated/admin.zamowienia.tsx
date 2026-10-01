import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminGetOrder, adminListOrders, adminResendDelivery, adminSalesSummary, adminSetOrderStatus } from "@/lib/orders.functions";
import { fmtDate, errMsg } from "@/components/admin/format";
import { fmtPrice } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_MAP } from "@/lib/notify/registry";

export const Route = createFileRoute("/_authenticated/admin/zamowienia")({ component: Orders });

const STATUS: Record<string, string> = { pending: "Oczekuje na płatność", paid: "Opłacone", failed: "Płatność nieudana", cancelled: "Anulowane", refund_pending: "Zwrot w toku", refunded: "Zwrócone", needs_review: "Wymaga weryfikacji" };
const PROVIDER: Record<string, string> = { manual: "Przelew tradycyjny", p24: "Przelewy24", tpay: "Tpay", payu: "PayU" };
const REASON: Record<string, string> = { simulated: "Tryb testowy poczty — wiadomość przygotowana jako symulacja, nie wysłano.", not_paid: "Zamówienie nie daje dostępu (nieopłacone lub dostęp cofnięty)." };
const EVENT: Record<string, string> = { created: "Utworzono", checkout_started: "Rozpoczęto płatność u operatora", checkout_error: "Błąd utworzenia transakcji", paid: "Opłacono", failed: "Płatność nieudana", cancelled: "Anulowano", refund_pending: "Zwrot w toku", refunded: "Zwrócono", delivered: "Dostarczono", delivered_manual: "Oznaczono jako przekazany", delivery_failed: "Wysyłka nieudana", duplicate_ignored: "Powtórzone powiadomienie pominięte", access_granted: "Przyznano dostęp", access_resent: "Ponowne wysłanie linku", needs_review: "Wymaga weryfikacji", webhook_pending: "Operator: płatność w toku", webhook_rejected: "Powiadomienie odrzucone" };
const TestBadge = () => <span className="ml-2 inline-block border border-destructive px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-destructive">TEST</span>;
const field = "h-10 border border-border/60 bg-background px-3 text-sm";

function Orders() {
  const list = useServerFn(adminListOrders); const summary = useServerFn(adminSalesSummary);
  const [q, setQ] = useState(""); const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); const [provider, setProvider] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [kind, setKind] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-orders", search, status, provider, from, to, kind], queryFn: () => list({ data: { q: search, status: status as "all", provider: provider as "all", from, to, kind: kind as "all" } }) });
  const sum = useQuery({ queryKey: ["admin-sales"], queryFn: () => summary() });
  const s = sum.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase">Sprzedaż i zamówienia</h1>
        <p className="mt-1 text-sm text-muted-foreground">Zamówienia materiałów premium. Płatności online potwierdza wyłącznie operator (zweryfikowane powiadomienie). Ręcznie można potwierdzić tylko przelew tradycyjny. <Link to="/admin/platnosci" className="text-gold underline">Konfiguracja operatorów</Link></p>
      </div>
      {s && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Opłacone zamówienia", String(s.paidCount)], ["Przychód łącznie", fmtPrice(s.paidAmount)], ["Przychód w tym miesiącu", fmtPrice(s.monthAmount)], ["Zwroty", `${s.refunded} (${fmtPrice(s.refundedAmount)})`], ["Oczekujące", String(s.pending)], ["Wymaga weryfikacji", String(s.review)], ...Object.entries(s.byProvider).map(([k, v]) => [`Opłacone: ${PROVIDER[k] ?? k}`, `${v.count} · ${fmtPrice(v.amount)}`])].map(([k, v]) => (
            <div key={k} className="border border-border/60 bg-card p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></div>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Zestawienie z rzeczywistych zamówień. Zamówienia testowe ({s.testOrders}) nie są wliczane.</p>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q); }} className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nr zamówienia, e-mail lub materiał" className="h-10 max-w-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field} aria-label="Status">
          <option value="all">Wszystkie statusy</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={field} aria-label="Operator">
          <option value="all">Wszystkie metody</option>{Object.entries(PROVIDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field} aria-label="Rodzaj zamówień">
          <option value="all">Rzeczywiste i testowe</option><option value="real">Rzeczywiste</option><option value="test">Testowe</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} aria-label="Od" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} aria-label="Do" />
        <Button type="submit" variant="outline" className="h-10">Szukaj</Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p> : error ? <p className="text-sm text-destructive">{errMsg(error)}</p> : !data?.length ? (
        <p className="border border-border/60 p-6 text-sm text-muted-foreground">Brak zamówień.</p>
      ) : (
        <><ul className="space-y-2 md:hidden">{data.map((r: any) => (
          <li key={r.id}><button type="button" onClick={() => setOpenId(r.id)} className={`w-full border p-4 text-left text-sm ${openId === r.id ? "border-gold bg-card" : "border-border/60"}`}>
            <span className="flex justify-between gap-2"><span className="font-mono text-xs">{r.order_number}{r.is_test && <TestBadge />}</span><span className="text-gold">{STATUS[r.status] ?? r.status}</span></span>
            <span className="mt-1 block break-words">{r.library_items?.title}</span>
            <span className="mt-1 block break-all text-xs text-muted-foreground">{r.buyer_email}</span>
            <span className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{fmtDate(r.created_at)} · {PROVIDER[r.provider] ?? r.provider}{r.environment === "sandbox" && r.provider !== "manual" ? " (test)" : ""}</span><span className="text-foreground">{fmtPrice(r.amount)}</span></span>
          </button></li>))}</ul>
        <div className="hidden overflow-x-auto border border-border/60 md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border/60">
              <th className="p-3">Nr</th><th className="p-3">Data</th><th className="p-3">Materiał</th><th className="p-3">E-mail</th><th className="p-3">Kwota</th><th className="p-3">Metoda</th><th className="p-3">Status</th></tr></thead>
            <tbody>{data.map((r: any) => (
              <tr key={r.id} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(r.id); }} onClick={() => setOpenId(r.id)} className={`cursor-pointer border-b border-border/40 hover:bg-card ${openId === r.id ? "bg-card" : ""}`}>
                <td className="whitespace-nowrap p-3 font-mono text-xs">{r.order_number}{r.is_test && <TestBadge />}</td>
                <td className="p-3">{fmtDate(r.created_at)}</td><td className="p-3">{r.library_items?.title}</td><td className="p-3">{r.buyer_email}</td>
                <td className="p-3">{fmtPrice(r.amount)}</td><td className="p-3">{PROVIDER[r.provider] ?? r.provider}{r.environment === "sandbox" && r.provider !== "manual" ? " (test)" : ""}</td>
                <td className="p-3">{STATUS[r.status] ?? r.status}</td>
              </tr>))}</tbody>
          </table>
        </div></>
      )}
      {openId && <OrderDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

type Action = "paid" | "delivered" | "cancelled" | "refund_start" | "refund_complete" | "review_paid" | "review_failed";

function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(adminGetOrder); const resend = useServerFn(adminResendDelivery); const setSt = useServerFn(adminSetOrderStatus);
  const qc = useQueryClient();
  const [reason, setReason] = useState(""); const [revoke, setRevoke] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["admin-order", id], queryFn: () => get({ data: { id } }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-sales"] }); };
  const m = useMutation({
    mutationFn: () => resend({ data: { id } }),
    onSuccess: (r) => { r.ok ? toast.success("Link do materiału wysłany.") : toast.message(REASON[r.reason] ?? r.reason); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const act = useMutation({
    mutationFn: (v: { action: Action; confirmNumber?: string }) => setSt({ data: { id, action: v.action, reason, revokeAccess: revoke, confirmNumber: v.confirmNumber ?? "" } }),
    onSuccess: () => { toast.success("Zapisano zmianę statusu."); setReason(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Ładowanie szczegółów…</p>;
  const o: any = data.order;
  const confirmDo = (a: Action, msg: string) => { if (window.confirm(msg)) act.mutate({ action: a }); };
  const typed = (a: Action, msg: string) => { const n = window.prompt(`${msg}\n\nAby potwierdzić, wpisz numer zamówienia: ${o.order_number}`); if (n) act.mutate({ action: a, confirmNumber: n }); };
  const row = (k: string, v: React.ReactNode) => <div className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2"><span className="text-muted-foreground">{k}</span><span className="break-all text-right">{v ?? "—"}</span></div>;
  const online = o.payment_method === "online";
  return (
    <section ref={(el) => { if (el && el.dataset["shown"] !== o.id) { el.dataset["shown"] = o.id; el.scrollIntoView({ behavior: "smooth", block: "start" }); } }} className="scroll-mt-4 border border-gold/40 bg-card p-5 text-sm">
      <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Zamówienie {o.order_number}{o.is_test && <TestBadge />}</h2><button onClick={onClose} className="text-gold underline">Zamknij</button></div>
      {o.is_test && <p className="mt-2 border border-destructive/60 p-2 text-xs text-destructive">Zamówienie testowe — nie jest wliczane do przychodów ani statystyk sprzedaży. Status, historia i dostęp działają bez zmian.</p>}
      <div className="mt-4 grid gap-x-8 md:grid-cols-2">
        <div>
          {row("Materiał", o.library_items?.title)}{row("Kwota", `${fmtPrice(o.amount)} (${o.currency})`)}{row("Status", STATUS[o.status] ?? o.status)}
          {row("Metoda / operator", `${PROVIDER[o.provider] ?? o.provider}${online ? ` — środowisko ${o.environment === "sandbox" ? "testowe" : "produkcyjne"}` : ""}`)}
          {row("Id transakcji operatora", o.provider_ref)}{row("Telefon", o.buyer_phone)}{row("Konto", o.user_id ? "Zakup na koncie" : "Gość (dostęp przez link i adres e-mail)")}
          {row("Dostęp do materiału", data.access ? "Przyznany" : o.access_revoked_at ? `Cofnięty ${fmtDate(o.access_revoked_at)}` : "Brak")}
        </div>
        <div>
          {row("Kupujący", o.buyer_name)}{row("E-mail", o.buyer_email)}{row("Utworzono", fmtDate(o.created_at))}
          {row("Opłacono", o.paid_at && fmtDate(o.paid_at))}{row("Opłacone oznaczył", o.paid_marked_by ? (data.names[o.paid_marked_by] ?? o.paid_marked_by) : o.paid_at && online ? "Operator (automatycznie)" : null)}
          {row("Przyczyna weryfikacji", o.review_reason)}{row("Przyczyna zwrotu", o.refund_reason)}
          {row("Ostatnia zmiana", o.status_changed_at && `${fmtDate(o.status_changed_at)} — ${data.names[o.status_changed_by] ?? "system"}`)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {o.status === "pending" && !online && <Button onClick={() => confirmDo("paid", "Potwierdzasz, że przelew za to zamówienie jest zaksięgowany na koncie?")} disabled={act.isPending}>Potwierdź wpłatę przelewem</Button>}
        {data.access && <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Wysyłanie…" : "Wyślij link do materiału ponownie"}</Button>}
        {o.status === "paid" && !o.delivered_at && <Button variant="outline" onClick={() => confirmDo("delivered", "Oznaczyć materiał jako przekazany ręcznie?")} disabled={act.isPending}>Oznacz jako przekazany</Button>}
        {["pending", "failed", "needs_review"].includes(o.status) && <Button variant="outline" onClick={() => confirmDo("cancelled", "Anulować zamówienie?")} disabled={act.isPending}>Anuluj</Button>}
        {o.status === "needs_review" && <>
          <Button onClick={() => typed("review_paid", "Potwierdź płatność TYLKO po sprawdzeniu w panelu operatora, że wpłynęła pełna kwota.")} disabled={act.isPending}>Weryfikacja: płatność poprawna</Button>
          <Button variant="outline" onClick={() => typed("review_failed", "Uznać płatność za nieudaną?")} disabled={act.isPending}>Weryfikacja: nieudana</Button>
        </>}
      </div>
      {o.status === "paid" && (
        <div className="mt-5 border border-border/60 p-4">
          <p className="eyebrow text-gold">Rejestracja zwrotu</p>
          <p className="mt-1 text-xs text-muted-foreground">Automatyczny zwrot nie jest jeszcze dostępny — {online ? `środki zwróć w panelu ${PROVIDER[o.provider]}` : "zwróć środki przelewem"}, a tutaj zarejestruj zwrot.</p>
          <Input className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Przyczyna zwrotu" maxLength={500} />
          <Button className="mt-2" variant="outline" onClick={() => typed("refund_start", "Rozpocząć zwrot (status „Zwrot w toku”)?")} disabled={act.isPending || reason.trim().length < 3}>Rozpocznij zwrot</Button>
        </div>
      )}
      {o.status === "refund_pending" && (
        <div className="mt-5 border border-border/60 p-4">
          <p className="eyebrow text-gold">Zakończenie zwrotu</p>
          <p className="mt-1 text-xs text-muted-foreground">Zakończ dopiero, gdy zwrot został wykonany {online ? `w panelu ${PROVIDER[o.provider]}` : "przelewem"}.</p>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} /> Cofnij kupującemu dostęp do materiału</label>
          <Button className="mt-2" variant="outline" onClick={() => typed("refund_complete", revoke ? "Zakończyć zwrot i COFNĄĆ dostęp?" : "Zakończyć zwrot i POZOSTAWIĆ dostęp?")} disabled={act.isPending}>Oznacz jako zwrócone</Button>
        </div>
      )}
      <h3 className="mt-6 eyebrow text-gold">Historia zamówienia i płatności</h3>
      <ul className="mt-2 space-y-1">{data.events.map((e: any, i: number) => <li key={i}><span className="text-muted-foreground">{fmtDate(e.created_at)}</span> — {EVENT[e.type] ?? e.type}{e.detail ? `: ${e.detail}` : ""}</li>)}</ul>
      <h3 className="mt-6 eyebrow text-gold">Wiadomości e-mail</h3>
      {!data.mails.length ? <p className="mt-2 text-muted-foreground">Brak.</p> : <ul className="mt-2 space-y-1">{data.mails.map((e: any, i: number) => <li key={i}><span className="text-muted-foreground">{fmtDate(e.created_at)}</span> — {EVENT_MAP[e.template_key ?? e.kind]?.name ?? e.template_key ?? e.kind}: {e.status === "sent" ? "wysłano" : e.status === "simulated" ? "symulacja (nie wysłano)" : `${e.status}${e.reason ? ` (${e.reason})` : ""}`}</li>)}</ul>}
    </section>
  );
}
