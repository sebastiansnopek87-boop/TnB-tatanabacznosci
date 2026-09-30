import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminEvents } from "@/lib/admin.functions";
import { errMsg, fmtDate } from "@/components/admin/format";

export const Route = createFileRoute("/_authenticated/admin/dziennik")({ component: Journal });

const RESULT: Record<string, string> = { ok: "Wykonano", failed: "Błąd", denied: "Odmowa dostępu" };

function Journal() {
  const fn = useServerFn(listAdminEvents);
  const { data, error } = useQuery({ queryKey: ["admin-events"], queryFn: () => fn() });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Dziennik zdarzeń</h1>
      <p className="mt-2 text-sm text-muted-foreground">Działania wykonane w panelu: publikacje, moderacja, zamówienia i odmowy dostępu. Ostatnie 300 wpisów.</p>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      {!data && !error && <p className="mt-4 text-sm text-muted-foreground">Ładowanie…</p>}
      {data?.length === 0 && <p className="mt-6 border border-border/60 p-4 text-sm text-muted-foreground">Brak zdarzeń. Wpisy pojawią się po pierwszych działaniach w panelu.</p>}
      {!!data?.length && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Zdarzenie</th><th className="p-2">Obiekt</th><th className="p-2">Wynik</th><th className="p-2">Szczegóły</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap p-2">{fmtDate(e.created_at)}</td>
                  <td className="p-2">{e.type}</td>
                  <td className="p-2 text-muted-foreground">{e.object_kind ?? "—"}</td>
                  <td className={e.result === "ok" ? "p-2" : "p-2 text-destructive"}>{RESULT[e.result] ?? e.result}</td>
                  <td className="p-2 text-muted-foreground">{e.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
