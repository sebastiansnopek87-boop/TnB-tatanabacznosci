import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSecurityStatus } from "@/lib/platform.functions";
import { fmtDate, errMsg } from "@/components/admin/format";
import { EVENT_LABELS, RESULT, actorName } from "@/components/admin/events";

export const Route = createFileRoute("/_authenticated/admin/bezpieczenstwo")({ component: Security });

const STATE = {
  ok: { label: "Działa", cls: "border-gold/60 text-gold" },
  warn: { label: "Wymaga uwagi", cls: "border-destructive/60 text-destructive" },
  unverified: { label: "Niezweryfikowany", cls: "border-border text-muted-foreground" },
} as const;

function Security() {
  const fn = useServerFn(getSecurityStatus);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-security"], queryFn: () => fn() });
  if (error) return <p className="text-sm text-destructive">{errMsg(error)}</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase">Bezpieczeństwo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stan mechanizmów, które faktycznie działają w aplikacji. Ten ekran niczego nie zmienia — zasady dostępu pozostają bez zmian.</p>
      </div>
      <ul className="space-y-3">
        {data.checks.map((c) => (
          <li key={c.key} className="border border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{c.label}</h2>
              <span className={`border px-2 py-0.5 text-xs uppercase tracking-wider ${STATE[c.state].cls}`}>{STATE[c.state].label}</span>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{c.detail}</p>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="font-display text-xl font-semibold uppercase">Odmowy i błędy (30 dni)</h2>
        {data.events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Brak odmów dostępu i błędów w ostatnich 30 dniach.</p> : (
          <ul className="mt-3 divide-y divide-border/60 border border-border/60">
            {data.events.map((e) => (
              <li key={e.id} className="p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><span>{EVENT_LABELS[e.type] ?? "Inne zdarzenie"}</span><span className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</span></div>
                <p className="text-xs text-muted-foreground">{actorName(e.actor_email, e.actor)} · {RESULT[e.result] ?? e.result}{e.detail ? ` · ${e.detail}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
        <Link to="/admin/dziennik" className="mt-3 inline-block text-sm text-gold underline">Pełny Dziennik zdarzeń</Link>
      </section>
    </div>
  );
}
