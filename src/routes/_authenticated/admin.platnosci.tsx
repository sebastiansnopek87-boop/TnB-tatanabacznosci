import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listPaymentProviders, setPaymentEnvironment, testPaymentProvider, updatePaymentProvider } from "@/lib/payments.functions";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/platnosci")({ component: Payments });

function Payments() {
  const list = useServerFn(listPaymentProviders);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-payments"], queryFn: () => list() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase">Operatorzy płatności</h1>
        <p className="mt-1 text-sm text-muted-foreground">Przelewy24, Tpay i PayU korzystają z jednego mechanizmu zamówień. Klucze tajne są przechowywane w bezpiecznym magazynie sekretów serwera i nigdy nie trafiają do przeglądarki — tutaj widać tylko, czy zostały ustawione. Zmiany może wprowadzać superadministrator.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p> : error ? <p className="text-sm text-destructive">{errMsg(error)}</p> :
        data!.providers.map((p: any) => <ProviderCard key={p.id} p={p} canEdit={data!.canEdit} />)}
    </div>
  );
}

function ProviderCard({ p, canEdit }: { p: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(updatePaymentProvider); const setEnv = useServerFn(setPaymentEnvironment); const test = useServerFn(testPaymentProvider);
  const [f, setF] = useState({ enabled: p.enabled, isDefault: p.is_default, merchant_id: p.merchant_id ?? "", pos_id: p.pos_id ?? "", client_id: p.client_id ?? "" });
  useEffect(() => { setF({ enabled: p.enabled, isDefault: p.is_default, merchant_id: p.merchant_id ?? "", pos_id: p.pos_id ?? "", client_id: p.client_id ?? "" }); }, [p]);
  const done = () => qc.invalidateQueries({ queryKey: ["admin-payments"] });
  const s = useMutation({ mutationFn: () => save({ data: { id: p.id, ...f } }), onSuccess: () => { toast.success("Zapisano konfigurację."); done(); }, onError: (e) => toast.error(errMsg(e)) });
  const e = useMutation({ mutationFn: (v: { environment: "sandbox" | "live"; confirm: string }) => setEnv({ data: { id: p.id, ...v } }), onSuccess: () => { toast.success("Zmieniono środowisko."); done(); }, onError: (x) => toast.error(errMsg(x)) });
  const t = useMutation({ mutationFn: () => test({ data: { id: p.id } }), onSuccess: (r) => { r.ok ? toast.success(r.detail) : toast.error(r.detail); done(); }, onError: (x) => toast.error(errMsg(x)) });
  const live = p.environment === "live";
  return (
    <section className="border border-border/60 bg-card p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{p.label}</h2>
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider">
          <span className={`border px-2 py-1 ${p.status.configured ? "border-gold text-gold" : "border-border text-muted-foreground"}`}>{p.status.configured ? "Skonfigurowany" : "Niekompletna konfiguracja"}</span>
          <span className="border border-border px-2 py-1">{p.enabled ? "Włączony" : "Wyłączony"}</span>
          {p.is_default && <span className="border border-gold px-2 py-1 text-gold">Domyślny</span>}
          <span className={`border px-2 py-1 ${live ? "border-destructive text-destructive" : "border-border"}`}>{live ? "Produkcja" : "Środowisko testowe"}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="eyebrow text-gold">Dane identyfikacyjne</p>
          {p.fields.map((fl: any) => (
            <label key={fl.key} className="block">{fl.label}
              <Input className="mt-1" value={(f as any)[fl.key]} disabled={!canEdit} onChange={(ev) => setF({ ...f, [fl.key]: ev.target.value })} maxLength={120} />
            </label>
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} disabled={!canEdit} onChange={(ev) => setF({ ...f, enabled: ev.target.checked, isDefault: ev.target.checked && f.isDefault })} /> Włącz operatora w formularzu zakupu</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isDefault} disabled={!canEdit || !f.enabled} onChange={(ev) => setF({ ...f, isDefault: ev.target.checked })} /> Operator domyślny</label>
          {canEdit && <Button onClick={() => s.mutate()} disabled={s.isPending}>{s.isPending ? "Zapisywanie…" : "Zapisz"}</Button>}
        </div>
        <div className="space-y-3">
          <p className="eyebrow text-gold">Klucze tajne (magazyn sekretów)</p>
          <ul className="space-y-1">{p.status.secrets.map((x: any) => <li key={x.name} className="flex justify-between gap-2 border-b border-border/40 py-1"><span>{x.label} <span className="font-mono text-xs text-muted-foreground">{x.name}</span></span><span className={x.set ? "text-gold" : "text-muted-foreground"}>{x.set ? "Ustawiony" : "Brak"}</span></li>)}</ul>
          <p className="text-xs text-muted-foreground">Skąd wziąć dane: {p.docs}. Klucze dodaje się przez bezpieczny formularz sekretów (poproś o to w czacie z asystentem) — nie wpisuj ich w żadne pole strony.</p>
          {!p.status.configured && <p className="text-xs text-destructive">Brakuje: {p.status.missing.join(", ")}.</p>}
          <p className="text-xs">Adres powiadomień (webhook) do wpisania w panelu operatora:<br /><span className="break-all font-mono">{p.webhookUrl}</span></p>
          <p className="text-xs text-muted-foreground">Zwroty: {p.refunds}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => t.mutate()} disabled={t.isPending || !p.status.configured} title={p.status.configured ? undefined : "Najpierw uzupełnij brakujące dane"}>{t.isPending ? "Sprawdzanie…" : "Test połączenia"}</Button>
            {canEdit && (live
              ? <Button variant="outline" onClick={() => e.mutate({ environment: "sandbox", confirm: "" })} disabled={e.isPending}>Przełącz na testowe</Button>
              : <Button variant="outline" onClick={() => { const c = window.prompt("Środowisko produkcyjne pobiera PRAWDZIWE pieniądze. Upewnij się, że klucze produkcyjne są ustawione.\n\nAby potwierdzić, wpisz: URUCHAMIAM PRODUKCJĘ"); if (c) e.mutate({ environment: "live", confirm: c }); }} disabled={e.isPending || !p.status.configured || !p.last_test_ok} title={!p.status.configured ? "Najpierw uzupełnij brakujące dane" : !p.last_test_ok ? "Najpierw wykonaj udany test połączenia" : undefined}>Uruchom produkcję…</Button>)}
          </div>
          {(!p.status.configured || (!live && canEdit && !p.last_test_ok)) && <p className="text-xs text-muted-foreground">{!p.status.configured ? "Test połączenia i produkcja będą dostępne po uzupełnieniu danych." : "Produkcję można uruchomić po udanym teście połączenia."}</p>}
          {p.last_test_at && <p className={`text-xs ${p.last_test_ok ? "text-gold" : "text-destructive"}`}>Ostatni test {fmtDate(p.last_test_at)}: {p.last_test_detail}</p>}
        </div>
      </div>
    </section>
  );
}
