import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAdminEvents } from "@/lib/admin.functions";
import { errMsg, fmtDate } from "@/components/admin/format";
import { EVENT_CATEGORIES, OBJECT_KIND, RESULT, actorName, eventLabel, typesMatching } from "@/components/admin/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/dziennik")({ component: Journal });

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function Journal() {
  const fn = useServerFn(listAdminEvents);
  const [f, setF] = useState({ from: "", to: "", category: "", actor: "", result: "" as "" | "ok" | "failed" | "denied", q: "" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setF((o) => ({ ...o, q })); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  const upd = (p: Partial<typeof f>) => { setF((o) => ({ ...o, ...p })); setPage(0); };
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["admin-events", f, page],
    queryFn: () => fn({ data: { ...f, typeIn: typesMatching(f.q), page } }),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Dziennik zdarzeń</h1>
      <p className="mt-2 text-sm text-muted-foreground">Działania wykonane w panelu: publikacje, edycje, moderacja, zamówienia, spotkania, rozmowy 1:1 i odmowy dostępu.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Input placeholder="Szukaj zdarzenia lub obiektu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj" className="xl:col-span-2" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Od<Input type="date" value={f.from} onChange={(e) => upd({ from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Do<Input type="date" value={f.to} onChange={(e) => upd({ to: e.target.value })} /></label>
        <select className={sel} value={f.category} onChange={(e) => upd({ category: e.target.value })} aria-label="Kategoria">
          <option value="">Wszystkie kategorie</option>
          {EVENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className={sel} value={f.result} onChange={(e) => upd({ result: e.target.value as typeof f.result })} aria-label="Wynik operacji">
          <option value="">Każdy wynik</option>
          {Object.entries(RESULT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel} value={f.actor} onChange={(e) => upd({ actor: e.target.value })} aria-label="Użytkownik">
          <option value="">Wszyscy użytkownicy</option>
          {data?.actors.map((a) => <option key={a.id} value={a.id}>{actorName(a.email, a.id)}</option>)}
        </select>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Odświeżanie…" : "Odśwież"}</Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      {!data && !error && <p className="mt-4 text-sm text-muted-foreground">Ładowanie…</p>}
      {data?.rows.length === 0 && <p className="mt-6 border border-border/60 p-4 text-sm text-muted-foreground">Brak zdarzeń dla wybranych filtrów.</p>}
      {!!data?.rows.length && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Zdarzenie</th><th className="p-2">Kto</th><th className="p-2">Obiekt</th><th className="p-2">Wynik</th></tr></thead>
            <tbody>
              {data.rows.map((e) => (
                <tr key={e.id} className="border-t border-border/60 align-top">
                  <td className="whitespace-nowrap p-2">{fmtDate(e.created_at)}</td>
                  <td className="p-2">{eventLabel(e.type)}</td>
                  <td className="p-2 text-muted-foreground">{actorName(e.actor_email, e.actor)}</td>
                  <td className="p-2 text-muted-foreground">{e.object_kind ? OBJECT_KIND[e.object_kind] ?? e.object_kind : "—"}{e.detail ? ` · ${e.detail}` : ""}</td>
                  <td className={e.result === "ok" ? "p-2" : "p-2 text-destructive"}>{RESULT[e.result] ?? e.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 0 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Poprzednia</Button>
          <span className="text-muted-foreground">Strona {page + 1} z {pages} · {data.total} wpisów</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Następna</Button>
        </div>
      )}
    </div>
  );
}
