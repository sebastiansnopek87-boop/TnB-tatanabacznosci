import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { controlCenterSearch } from "@/lib/control-center.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, errMsg } from "@/components/admin/format";
import { Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/centrum-kontroli")({
  head: () => ({
    meta: [
      { title: "Centrum kontroli — Tata Na Baczności" },
      { name: "description", content: "Wyszukiwanie i podgląd powiązanych danych: konta, zamówienia, zgłoszenia, zdarzenia." },
      { property: "og:title", content: "Centrum kontroli — Tata Na Baczności" },
      { property: "og:description", content: "Centrum kontroli TNB." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ControlCenterPage,
});

const ORDER_STATUS: Record<string, string> = {
  pending: "Oczekujące", paid: "Opłacone", failed: "Nieudane", cancelled: "Anulowane",
  refund_pending: "Zwrot w toku", refunded: "Zwrócone", needs_review: "Do weryfikacji",
};

type Result = Awaited<ReturnType<typeof controlCenterSearch>>;

function ControlCenterPage() {
  const search = useServerFn(controlCenterSearch);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try { setRes(await search({ data: { q } })); }
    catch (e) { setError(errMsg(e)); setRes(null); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase">Centrum kontroli</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tryb tylko do odczytu. Wyszukaj po adresie e-mail, nazwisku, TNB ID lub numerze zamówienia.</p>
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. jan@example.com, Kowalski, TNB-2026-12 lub TNB ID" className="max-w-md" />
        <Button type="submit" disabled={busy || q.trim().length < 2}>
          <Search className="mr-2 h-4 w-4" aria-hidden />{busy ? "Szukam…" : "Szukaj"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {res && (
        <div className="space-y-8">
          <section>
            <h2 className="eyebrow text-gold">Konta ({res.users.length})</h2>
            {res.users.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Brak pasujących kont.</p> : (
              <ul className="mt-2 divide-y divide-border/60 border border-border/60">
                {res.users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <Link to="/admin/uzytkownicy" className="font-medium text-foreground underline-offset-4 hover:underline">{u.email ?? u.id}</Link>
                    {u.name && <span className="text-muted-foreground">{u.name}</span>}
                    {u.tnbId && <span className="text-xs text-muted-foreground">TNB ID: {u.tnbId}</span>}
                    {u.roles.length > 0 && <span className="text-xs text-gold">{u.roles.join(", ")}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{u.confirmed ? "potwierdzone" : "niepotwierdzone"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="eyebrow text-gold">Zamówienia ({res.orders.length})</h2>
            {res.orders.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Brak pasujących zamówień.</p> : (
              <ul className="mt-2 divide-y divide-border/60 border border-border/60">
                {res.orders.map((o) => (
                  <li key={o.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link to="/admin/zamowienia" className="font-medium text-foreground underline-offset-4 hover:underline">{o.orderNumber}</Link>
                      <Link to="/admin/biblioteka" className="text-muted-foreground underline-offset-4 hover:underline">{o.itemTitle}</Link>
                      <span>{(o.amount / 100).toFixed(2)} {o.currency}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span>
                      {o.isTest && <span className="text-xs text-muted-foreground">(testowe)</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>Zamówienie: <strong>{ORDER_STATUS[o.status] ?? o.status}</strong></span>
                      <span>Płatność: <strong>{o.paidAt ? `opłacona ${fmtDate(o.paidAt)}` : "nieopłacona"}</strong></span>
                      <span>Dostęp: <strong className={o.access ? "text-gold" : ""}>{o.access ? "aktywny" : "brak"}</strong>{o.accessRevokedAt ? " (cofnięty)" : ""}</span>
                    </div>
                    {o.warnings.map((w) => (
                      <p key={w} className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{w}</p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="eyebrow text-gold">Bezpłatne zgłoszenia ({res.requests.length})</h2>
            {res.requests.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Brak pasujących zgłoszeń.</p> : (
              <ul className="mt-2 divide-y divide-border/60 border border-border/60">
                {res.requests.map((r) => (
                  <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium">{r.itemTitle}</span>
                      <span className="text-muted-foreground">{r.email ?? r.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span>Status: {r.status}</span>
                      <span>Pobrania: {r.downloadCount}{r.downloadedAt ? ` (ostatnie ${fmtDate(r.downloadedAt)})` : ""}</span>
                    </div>
                    {r.warnings.map((w) => (
                      <p key={w} className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{w}</p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="eyebrow text-gold">Oś zdarzeń ({res.timeline.length})</h2>
            {res.timeline.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Brak zdarzeń.</p> : (
              <ul className="mt-2 divide-y divide-border/60 border border-border/60">
                {res.timeline.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="text-xs text-muted-foreground">{fmtDate(e.at)}</span>
                    <span className={e.source === "admin" ? "text-gold" : "text-foreground"}>{e.label}</span>
                    {e.result && e.result !== "ok" && <span className="text-xs text-destructive">{e.result}</span>}
                    {e.detail && <span className="w-full text-xs text-muted-foreground">{e.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
