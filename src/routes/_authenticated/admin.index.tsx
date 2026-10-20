import { createFileRoute, Link } from "@tanstack/react-router";
import { errMsg, fmtDate } from "@/components/admin/format";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/admin.functions";
import { OBJECT_KIND, RESULT, actorName, eventLabel } from "@/components/admin/events";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowUpRight, ArrowRight, CircleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Pulpit administratora — Tata Na Baczności" },
    { name: "description", content: "Statystyki, zadania i ostatnia aktywność platformy Tata Na Baczności." },
    { property: "og:title", content: "Pulpit administratora — Tata Na Baczności" },
    { property: "og:description", content: "Przegląd statystyk i aktywności platformy Tata Na Baczności." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Dashboard,
});

const n = (v: number | null) => (v === null ? "Brak danych" : String(v));
const money = (grosze: number, cur: string) => (grosze / 100).toLocaleString("pl-PL", { style: "currency", currency: cur.toUpperCase() });

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data, error, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: () => fn(), staleTime: 60_000, refetchInterval: 5 * 60_000,
  });
  const d = data;
  const cards = d ? [
    { label: "Użytkownicy łącznie", value: n(d.usersTotal), to: "/admin/uzytkownicy" },
    { label: "Nowi użytkownicy (30 dni)", value: n(d.usersNew30), to: "/admin/uzytkownicy" },
    { label: "Opublikowane materiały", value: n(d.library), to: "/admin/biblioteka" },
    { label: "Posty w Społeczności", value: n(d.posts), to: "/admin/spolecznosc" },
    { label: "Nadchodzące spotkania", value: n(d.meetings), to: "/admin/spotkania" },
    { label: "Aktywne rezerwacje 1:1", value: n(d.bookings), to: "/admin/rozmowy" },
    { label: "Zamówienia", value: n(d.orders), to: "/admin/zamowienia" },
    { label: "Wartość opłaconych zamówień", value: d.paidTotal === null ? "Brak danych" : money(d.paidTotal, d.paidCurrency), to: "/admin/zamowienia" },
    { label: "Nowe wiadomości", value: n(d.newMsgs), to: "/admin/wiadomosci" },
    { label: "Błędy i odmowy (7 dni)", value: n(d.deniedWeek), to: "/admin/dziennik" },
  ] as const : [];
  const tasks = d ? [
    { n: d.reports, label: "zgłoszeń do moderacji", to: "/admin/spolecznosc" },
    { n: d.newMsgs, label: "wiadomości oczekujących na odpowiedź", to: "/admin/wiadomosci" },
    { n: d.pendingRegs, label: "zgłoszeń na spotkania do decyzji", to: "/admin/spotkania" },
    { n: d.pendingOrders, label: "zamówień oczekujących na płatność", to: "/admin/zamowienia" },
    { n: d.failedMail, label: "nieudanych wysyłek e-mail", to: "/admin/powiadomienia" },
    { n: d.deniedWeek, label: "błędów lub odmów dostępu w ostatnich 7 dniach", to: "/admin/dziennik" },
  ].filter((t) => (t.n ?? 0) > 0) : [];
  const quick = [
    { label: "Dodaj stronę", to: "/admin/strony" }, { label: "Dodaj materiał", to: "/admin/biblioteka" },
    { label: "Otwórz Społeczność", to: "/admin/spolecznosc" }, { label: "Otwórz spotkania", to: "/admin/spotkania" },
    { label: "Otwórz zamówienia", to: "/admin/zamowienia" }, { label: "Otwórz Dziennik zdarzeń", to: "/admin/dziennik" },
  ] as const;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold">Pulpit</h1>
          {d && <p className="mt-2 text-sm text-muted-foreground">Stan na {fmtDate(new Date(dataUpdatedAt).toISOString())}</p>}
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => refetch()} disabled={isFetching}><RefreshCw aria-hidden className={isFetching ? "animate-spin motion-reduce:animate-none" : ""} />{isFetching ? "Odświeżanie…" : "Odśwież"}</Button>
      </div>
      {error && <p className="text-sm text-destructive">{errMsg(error)}</p>}
      {!d && !error && <p className="text-sm text-muted-foreground">Ładowanie…</p>}

      {d && <>
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {cards.map((c) => {
            const body = <>
              <div className="flex items-start justify-between gap-3"><p className="min-h-10 text-sm font-medium leading-5 text-muted-foreground">{c.label}</p><ArrowUpRight className="size-4 shrink-0 text-admin-copper" aria-hidden /></div>
              <p className={c.value === "Brak danych" ? "mt-4 text-base text-muted-foreground" : "mt-4 break-words text-3xl font-semibold leading-tight tabular-nums text-foreground"}>{c.value}</p>
            </>;
            return <Link key={c.label} to={c.to} className="min-h-36 min-w-0 rounded-md border border-border bg-card p-5 hover:border-admin-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>;
          })}
        </div>

        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CircleAlert className="size-5 text-admin-copper" aria-hidden />Wymaga uwagi</h2>
          {tasks.length === 0
            ? <p className="mt-3 border border-border/60 p-4 text-sm text-muted-foreground">Nic nie czeka na Twoje działanie.</p>
            : <ul className="mt-3 divide-y divide-border border-y border-border">
                {tasks.map((t) => (
                  <li key={t.label}><Link to={t.to} className="flex min-h-14 items-center gap-4 px-3 py-3 text-sm hover:bg-admin-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-6 text-center text-xl font-semibold tabular-nums text-gold">{t.n}</span><span className="flex-1">{t.label}</span><ArrowRight className="size-4 shrink-0 text-admin-copper" aria-hidden /></Link></li>
                ))}
              </ul>}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Szybkie akcje</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {quick.map((q) => <Button key={q.label} asChild variant="outline" size="sm" className="min-h-11"><Link to={q.to}>{q.label}<ArrowUpRight aria-hidden /></Link></Button>)}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ostatnia aktywność</h2>
            <Button asChild variant="link" size="sm" className="min-h-11 px-0"><Link to="/admin/dziennik">Pełny dziennik zdarzeń<ArrowRight aria-hidden /></Link></Button>
          </div>
          {d.recent.length === 0
            ? <p className="mt-3 border border-border/60 p-4 text-sm text-muted-foreground">Brak zdarzeń.</p>
            : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-border bg-admin-surface text-muted-foreground"><tr><th className="p-3">Data</th><th className="p-3">Zdarzenie</th><th className="p-3">Kto</th><th className="p-3">Obiekt</th><th className="p-3">Wynik</th></tr></thead>
                <tbody>{d.recent.map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="whitespace-nowrap p-3 tabular-nums">{fmtDate(e.created_at)}</td>
                    <td className="p-3">{eventLabel(e.type)}</td>
                    <td className="p-3 text-muted-foreground">{actorName(e.actor_email, e.actor)}</td>
                    <td className="p-3 text-muted-foreground">{e.object_kind ? OBJECT_KIND[e.object_kind] ?? e.object_kind : "—"}{e.detail ? ` · ${e.detail}` : ""}</td>
                    <td className={e.result === "ok" ? "p-3" : "p-3 text-destructive"}>{RESULT[e.result] ?? e.result}</td>
                  </tr>))}</tbody>
              </table></div>}
        </section>
      </>}
    </div>
  );
}
