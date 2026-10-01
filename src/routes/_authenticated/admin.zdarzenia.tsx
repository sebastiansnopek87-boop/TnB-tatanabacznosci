import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getNotificationOverview, setEventEnabled } from "@/lib/notifications.functions";
import { INTEGRATION_LABEL, MODULE_LABEL, type Module } from "@/lib/notify/registry";
import { errMsg } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/zdarzenia")({
  head: () => ({ meta: [{ title: "Zdarzenia i reguły — Panel TNB" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Rules,
});

function Rules() {
  const overview = useServerFn(getNotificationOverview);
  const setEnabled = useServerFn(setEventEnabled);
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-notif-overview"], queryFn: () => overview() });

  async function toggle(key: string, enabled: boolean) {
    try { await setEnabled({ data: { key, enabled } }); toast.success(enabled ? "Reguła włączona." : "Reguła wyłączona."); qc.invalidateQueries({ queryKey: ["admin-notif-overview"] }); }
    catch (e) { toast.error(errMsg(e)); }
  }

  const modules = Object.keys(MODULE_LABEL) as Module[];
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Zdarzenia i reguły</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">„Oczekuje na integrację” — szablon jest gotowy, ale moduł nie wywołuje jeszcze tego zdarzenia, więc nic nie zostanie wysłane. „Obsługiwane przez system logowania” — te wiadomości wysyła wbudowany mechanizm kont.</p>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Ładowanie…</p>}
      {data && modules.map((m) => {
        const evs = data.events.filter((e) => e.module === m);
        if (!evs.length) return null;
        return (
          <section key={m} className="mt-8">
            <h2 className="font-display text-xl uppercase text-gold">{MODULE_LABEL[m]}</h2>
            <div className="mt-3 overflow-x-auto border border-border/60">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr className="border-b border-border/60">
                  <th className="p-3">Zdarzenie</th><th className="p-3">Szablon</th><th className="p-3">Odbiorca</th><th className="p-3">Integracja</th><th className="p-3">Aktywne</th>
                </tr></thead>
                <tbody>{evs.map((e) => (
                  <tr key={e.key} className="border-b border-border/40 align-top">
                    <td className="p-3"><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.description}</p></td>
                    <td className="p-3">{e.name}{e.customized && <span className="ml-1 text-xs text-gold">(zmieniony)</span>}</td>
                    <td className="p-3">{e.recipient === "admin" ? `Administrator${data.settings.recipient ? ` (${data.settings.recipient})` : " — adres nieustawiony"}` : "Użytkownik"}</td>
                    <td className="p-3"><Badge variant={e.integration === "integrated" ? "default" : "outline"}>{INTEGRATION_LABEL[e.integration]}</Badge></td>
                    <td className="p-3">{e.integration === "integrated" && e.key !== "test_message"
                      ? <Switch aria-label={`Aktywne: ${e.name}`} checked={e.enabled} disabled={!data.canEdit} onCheckedChange={(v) => toggle(e.key, v)} />
                      : <span className="text-xs text-muted-foreground">{e.key === "test_message" ? "Zawsze" : "—"}</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
