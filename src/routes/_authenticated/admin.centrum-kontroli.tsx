import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { controlCenterSearch, controlCenterHistory } from "@/lib/control-center.functions";
import { type ReadState, type HistoryEvent } from "@/lib/control-center";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, errMsg } from "@/components/admin/format";
import { Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/centrum-kontroli")({
  head: () => ({ meta: [
    { title: "Centrum kontroli — Tata Na Baczności" },
    { name: "description", content: "Odczyt kont, zamówień, zgłoszeń i ich odrębnych historii w Centrum kontroli TNB." },
    { property: "og:title", content: "Centrum kontroli — Tata Na Baczności" },
    { property: "og:description", content: "Powiązane dane i historia zamówień TNB — wyłącznie odczyt." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }), component: ControlCenterPage,
});
const ORDER_STATUS: Record<string, string> = { pending: "Oczekujące", paid: "Opłacone", failed: "Nieudane", cancelled: "Anulowane", refund_pending: "Zwrot w toku", refunded: "Zwrócone", needs_review: "Do weryfikacji" };
type Result = Awaited<ReturnType<typeof controlCenterSearch>>;
function ReadNotice({ state, empty, children }: { state: ReadState; empty: boolean; children: string }) {
  return <div className="mt-2 space-y-1 text-sm">
    {state.error && <p role="alert" className="text-destructive">{state.error} Wyniki tego obszaru mogą być niepełne.</p>}
    {state.limited && <p className="text-gold">Osiągnięto limit wyników (100). Zawęź wyszukiwanie.</p>}
    {state.incomplete && <p className="text-gold">Powiązania mogą być niepełne: część źródeł jest niedostępna lub ograniczona limitem.</p>}
    {empty && !state.error && !state.incomplete && !state.limited && <p className="text-muted-foreground">{children}</p>}
  </div>;
}
function Matches({ userId, matches }: { userId: string | null; matches: Array<{ userId: string; kind: "user_id" | "email" }> }) {
  return <div className="space-y-1 text-xs text-muted-foreground">
    <p>{userId ? `Właściciel zapisany przez identyfikator konta: ${userId}` : "Gość — właściciel niepotwierdzony przez identyfikator konta."}</p>
    {matches.filter((m) => m.kind === "email").map((m) => <p key={m.userId} className="text-gold">Konto {m.userId}: zgodność adresu e-mail — wymaga weryfikacji.</p>)}
  </div>;
}
function Warnings({ rows }: { rows: string[] }) {
  return <>{rows.map((w) => <p key={w} className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />{w}</p>)}</>;
}
function History({ kind, id, title }: { kind: "order" | "user" | "library_request" | "actor"; id: string; title: string }) {
  const fetchHistory = useServerFn(controlCenterHistory);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<HistoryEvent[]>([]);
  const [next, setNext] = useState({ order: 0, admin: 0 });
  const [before, setBefore] = useState<string>();
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true); setOpened(true); setError(null);
    try {
      const result = await fetchHistory({ data: { kind, id, offsets: next, before } });
      if (result.error) { setError(result.error); return; }
      setRows((prev) => [...prev, ...result.rows]); setNext(result.next); setBefore(result.before); setMore(result.hasMore);
    } catch { setError("Nie udało się pobrać historii. Spróbuj ponownie."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 border-t border-border/60 pt-2">
    <Button variant="outline" size="sm" disabled={busy} onClick={() => opened ? setOpened(false) : rows.length || before ? setOpened(true) : load()}>{opened ? "Zwiń" : title}</Button>
    {opened && <div className="mt-3 space-y-2">
      <h3 className="font-medium">{title}</h3>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {busy && <p className="text-muted-foreground">Pobieranie historii…</p>}
      {!error && !busy && !rows.length && <p className="text-muted-foreground">Brak zapisanych zdarzeń w tych rejestrach.</p>}
      {rows.map((e) => <div key={`${e.source}-${e.id}`} className="space-y-1 border-l border-border pl-3 text-xs break-words">
        <p><span className="text-muted-foreground">{fmtDate(e.at)}</span> · <strong>{e.type}</strong>{e.result ? ` · ${e.result}` : ""}</p>
        <p className="text-muted-foreground">Źródło: {e.source === "order" ? "rejestr zamówienia" : "dziennik administratora"} · Aktor: {e.actor ?? "nie zapisano w źródle"}</p>
        <p className="text-muted-foreground">Obiekt: {e.objectKind} · {e.objectId}</p>
        {e.detail && <p>{e.detail}</p>}
      </div>)}
      {rows.length > 0 && <p className="text-xs text-muted-foreground">Wpisy z obu rejestrów pozostają oddzielne; mogą opisywać różne aspekty tej samej operacji.</p>}
      {more && <p className="text-xs text-gold">Historia niepełna — dostępne są starsze wpisy.</p>}
      {(more || error) && <Button variant="outline" size="sm" disabled={busy} onClick={load}>{error ? "Spróbuj ponownie" : "Pokaż starsze"}</Button>}
    </div>}
  </div>;
}
function ControlCenterPage() {
  const search = useServerFn(controlCenterSearch);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [runId, setRunId] = useState(0);
  async function run() {
    setBusy(true); setError(null); setRes(null);
    try { setRes(await search({ data: { q } })); setRunId((n) => n + 1); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-6 break-words">
    <div><h1 className="font-display text-2xl font-semibold uppercase">Centrum kontroli</h1><p className="mt-1 text-sm text-muted-foreground">Tryb tylko do odczytu. E-mail, imię i nazwisko, TNB ID, numer zamówienia lub slug materiału.</p></div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
      <Input aria-label="Wyszukaj w Centrum kontroli" value={q} onChange={(e) => setQ(e.target.value)} placeholder="E-mail, Jan Nowak, TNB ID, numer lub slug" className="min-w-0 max-w-md" />
      <Button type="submit" disabled={busy || q.trim().length < 2}><Search className="mr-2 h-4 w-4" aria-hidden />{busy ? "Szukam…" : "Szukaj"}</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {res && <div key={runId} className="space-y-8">
      <section><h2 className="eyebrow text-gold">Konta ({res.users.length})</h2><ReadNotice state={res.states.users} empty={!res.users.length}>Brak pasujących kont.</ReadNotice>
        <ul className="mt-2 divide-y divide-border/60 border border-border/60">{res.users.map((u) => <li key={u.id} className="space-y-2 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><Link to="/admin/uzytkownicy" className="font-medium underline-offset-4 hover:underline">{u.email ?? u.id}</Link>{u.name && <span>{u.name}</span>}{u.tnbId && <span className="text-xs text-muted-foreground">TNB ID: {u.tnbId}</span>}{u.roles && <span className="text-xs text-gold">{u.roles.join(", ")}</span>}<span className="text-xs text-muted-foreground">{u.confirmed === null ? "Potwierdzenie konta: nie odczytano" : u.confirmed ? "potwierdzone" : "niepotwierdzone"}</span></div>
          <p className="text-xs text-muted-foreground">Link otwiera listę użytkowników; szczegóły wybierz na liście.</p>
          <History kind="user" id={u.id} title="Historia obiektu konta" />
          <History kind="actor" id={u.id} title="Działania tej osoby jako aktora (oddzielny rejestr)" />
        </li>)}</ul>
      </section>
      {(res.materials.length > 0 || res.states.materials.error) && <section><h2 className="eyebrow text-gold">Materiały ({res.materials.length})</h2><ReadNotice state={res.states.materials} empty={!res.materials.length}>Brak pasujących materiałów.</ReadNotice>{res.materials.map((m) => <p key={m.id} className="mt-2 text-sm"><Link to="/admin/biblioteka" className="underline">{m.title}</Link> · {m.slug}</p>)}<p className="mt-1 text-xs text-muted-foreground">Link otwiera Bibliotekę; szczegóły materiału wybierz na liście.</p></section>}
      <section><h2 className="eyebrow text-gold">Zamówienia ({res.orders.length})</h2><ReadNotice state={res.states.orders} empty={!res.orders.length}>Brak pasujących zamówień.</ReadNotice>
        <ul className="mt-2 divide-y divide-border/60 border border-border/60">{res.orders.map((o) => <li key={o.id} className="space-y-2 px-4 py-3 text-sm" data-order={o.orderNumber}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><Link to="/admin/zamowienia" className="font-medium underline-offset-4 hover:underline">{o.orderNumber}</Link><Link to="/admin/biblioteka" className="text-muted-foreground underline-offset-4 hover:underline">{o.itemTitle}</Link><span>{(o.amount / 100).toFixed(2)} {o.currency}</span><span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span><span className="text-xs text-muted-foreground">{o.isTest ? "testowe (is_test=true)" : "rzeczywiste (is_test=false)"}</span></div>
          <p className="text-xs text-muted-foreground">{o.buyerEmail}{o.itemSlug ? ` · ${o.itemSlug}` : ""}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><span>Zamówienie: <strong>{ORDER_STATUS[o.status] ?? o.status}</strong></span><span>Płatność: <strong>{o.paidAt ? `opłacona ${fmtDate(o.paidAt)}` : "brak daty potwierdzenia płatności"}</strong></span><span>Dostęp: <strong className={o.access.allowed ? "text-gold" : ""}>{o.access.label}</strong>{o.accessRevokedAt ? " (cofnięty)" : ""}</span></div>
          {o.accessExpiresAt && <p className="text-xs text-muted-foreground">Zapisana data ważności: {fmtDate(o.accessExpiresAt)}. Istniejąca reguła dostępu nie uwzględnia tej daty.</p>}
          <Matches userId={o.userId} matches={o.matches} /><Warnings rows={o.warnings} />
          <p className="text-xs text-muted-foreground">Linki otwierają listy zamówień i materiałów; szczegóły wybierz na odpowiedniej liście.</p>
          <History kind="order" id={o.id} title={`Historia zamówienia ${o.orderNumber}`} />
        </li>)}</ul>
      </section>
      <section><h2 className="eyebrow text-gold">Bezpłatne zgłoszenia ({res.requests.length})</h2><ReadNotice state={res.states.requests} empty={!res.requests.length}>Brak pasujących zgłoszeń.</ReadNotice>
        <ul className="mt-2 divide-y divide-border/60 border border-border/60">{res.requests.map((r) => <li key={r.id} className="space-y-2 px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1"><Link to="/admin/biblioteka" className="font-medium underline-offset-4 hover:underline">{r.itemTitle}</Link><span className="text-muted-foreground">{r.name} · {r.email ?? "—"}</span></div>
          <p className="text-xs text-muted-foreground">Zgłoszenie: {fmtDate(r.createdAt)} · Status: {r.status} · Tryb: {r.mode}</p>
          <p className="text-xs">Zarejestrowane udostępnienia linku do pliku: {r.downloadCount}{r.downloadedAt ? ` · ostatnie: ${fmtDate(r.downloadedAt)}` : " · brak zapisanej daty"}</p>
          <p className="text-xs text-muted-foreground">Rejestr zapisuje wydanie linku, nie potwierdza zakończenia pobierania pliku. Brak osobnej historii każdego pobrania.</p>
          <Matches userId={r.userId} matches={r.matches} /><Warnings rows={r.warnings} />
          <p className="text-xs text-muted-foreground">Powiadomienie: {r.notificationStatus ?? "brak zapisanej informacji"}. Szczegóły: Biblioteka → Historia udostępnień.</p>
          <History kind="library_request" id={r.id} title="Zapisane zdarzenia zgłoszenia" />
        </li>)}</ul>
      </section>
    </div>}
  </div>;
}
