import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getEmailSettings, updateEmailSettings } from "@/lib/admin.functions";
import { fmtDate , errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/ustawienia-email")({ component: EmailSettings });

type Form = { notification_recipient: string; sender_name: string; sender_local_part: string; sender_domain: string; admin_inbox_url: string; contact_notifications_enabled: boolean; newsletter_notifications_enabled: boolean; newsletter_double_opt_in: boolean };

function EmailSettings() {
  const get = useServerFn(getEmailSettings);
  const save = useServerFn(updateEmailSettings);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-email-settings"], queryFn: () => get() });
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setF({
      notification_recipient: data.notification_recipient ?? "", sender_name: data.sender_name, sender_local_part: data.sender_local_part,
      sender_domain: data.sender_domain ?? "", admin_inbox_url: data.admin_inbox_url ?? "",
      contact_notifications_enabled: data.contact_notifications_enabled, newsletter_notifications_enabled: data.newsletter_notifications_enabled,
      newsletter_double_opt_in: data.newsletter_double_opt_in,
    });
  }, [data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      await save({ data: f });
      toast.success("Ustawienia zapisane.");
      qc.invalidateQueries({ queryKey: ["admin-email-settings"] });
    } catch (e) {
      const msg = (e as Error).message;
      let text = msg;
      try { const parsed = JSON.parse(msg); if (Array.isArray(parsed)) text = parsed.map((i: { message: string }) => i.message).join(" · "); } catch { /* plain */ }
      setErr(text); toast.error("Nie zapisano ustawień.");
    } finally { setBusy(false); }
  }

  if (error) return <p className="text-sm text-destructive">{errMsg(error)}</p>;
  if (!f) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold uppercase">Ustawienia e-mail</h1>
      <p className="border border-gold/50 p-4 text-sm text-foreground/80">
        Wysyłka e-mail nie jest jeszcze uruchomiona. Zapisane ustawienia zaczną działać po skonfigurowaniu domeny i dostawcy poczty — do tego czasu każde powiadomienie trafia do historii jako „pominięte”.
      </p>
      <div className="space-y-2"><Label htmlFor="rcpt">Adres odbiorcy powiadomień</Label>
        <Input id="rcpt" type="email" value={f.notification_recipient} onChange={(e) => set("notification_recipient", e.target.value)} placeholder="np. kontakt@twojadomena.pl" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="sn">Nazwa nadawcy</Label><Input id="sn" value={f.sender_name} onChange={(e) => set("sender_name", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sl">Adres nadawcy (przed @)</Label><Input id="sl" value={f.sender_local_part} onChange={(e) => set("sender_local_part", e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="sd">Domena nadawcy</Label>
        <Input id="sd" value={f.sender_domain} onChange={(e) => set("sender_domain", e.target.value)} placeholder="np. powiadomienia.twojadomena.pl" />
        <p className="text-xs text-muted-foreground">Nadawca: {f.sender_name} &lt;{f.sender_local_part}@{f.sender_domain || "…"}&gt;</p></div>
      <div className="space-y-2"><Label htmlFor="iu">Adres skrzynki w panelu (odnośnik w powiadomieniu)</Label>
        <Input id="iu" value={f.admin_inbox_url} onChange={(e) => set("admin_inbox_url", e.target.value)} placeholder="https://twojadomena.pl/admin/wiadomosci" /></div>
      <div className="space-y-4 border-t border-border/60 pt-6">
        <Toggle id="t1" label="Powiadomienia o nowych wiadomościach z Kontaktu" checked={f.contact_notifications_enabled} onChange={(v) => set("contact_notifications_enabled", v)} />
        <Toggle id="t2" label="Powiadomienia o nowych zapisach do newslettera" checked={f.newsletter_notifications_enabled} onChange={(v) => set("newsletter_notifications_enabled", v)} />
        <Toggle id="t3" label="Potwierdzanie zapisu do newslettera przez e-mail (double opt-in)" checked={f.newsletter_double_opt_in} onChange={(v) => set("newsletter_double_opt_in", v)} />
        {f.newsletter_double_opt_in && (
          <p className="text-xs text-destructive">Uwaga: dopóki wysyłka e-mail nie działa, nowi subskrybenci nie dostaną linku potwierdzającego i pozostaną w statusie „oczekuje”.</p>
        )}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz ustawienia"}</Button>
        <span className="text-xs text-muted-foreground">Ostatnia zmiana: {fmtDate(data?.updated_at)}</span>
      </div>
    </form>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
