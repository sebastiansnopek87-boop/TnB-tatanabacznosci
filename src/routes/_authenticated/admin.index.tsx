import { createFileRoute, Link } from "@tanstack/react-router";
import { errMsg } from "@/components/admin/format";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data, error } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });
  const cards = data ? [
    { label: "Nowe wiadomości", value: data.newMsgs, to: "/admin/wiadomosci" },
    { label: "Wiadomości w skrzynce", value: data.allMsgs, to: "/admin/wiadomosci" },
    { label: "Aktywni subskrybenci", value: data.active, to: "/admin/subskrybenci" },
    { label: "Oczekujący subskrybenci", value: data.pending, to: "/admin/subskrybenci" },
    { label: "Wypisani", value: data.unsub, to: "/admin/subskrybenci" },
    { label: "Błędy powiadomień", value: data.failed, to: "/admin/powiadomienia" },
  ] as const : [];
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Pulpit</h1>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      {!data && !error && <p className="mt-4 text-sm text-muted-foreground">Ładowanie…</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="border border-border/60 p-5 hover:border-gold">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-2 font-display text-4xl text-gold">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
