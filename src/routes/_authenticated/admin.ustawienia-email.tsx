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
import { getNotificationOverview, runDuplicateCheck, sendTestMessage, updateDeliveryConfig } from "@/lib/notifications.functions";

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
      <ProviderSection />
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
          <p className="text-xs text-destructive">Uwaga: dopóki rzeczywista wysyłka nie jest włączona, nowi subskrybenci nie dostaną linku potwierdzającego i pozostaną w statusie „oczekuje”.</p>
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

function ProviderSection() {
  const overview = useServerFn(getNotificationOverview);
  const saveCfg = useServerFn(updateDeliveryConfig);
  const test = useServerFn(sendTestMessage);
  const dup = useServerFn(runDuplicateCheck);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-notif-overview"], queryFn: () => overview() });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const rt = replyTo ?? data.settings.reply_to ?? "";
  const live = data.settings.delivery_mode === "live";

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    try { toast.success(await fn()); qc.invalidateQueries({ queryKey: ["admin-notif-overview"] }); qc.invalidateQueries({ queryKey: ["admin-log"] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 border border-gold/50 p-4 text-sm" aria-label="Dostawca poczty">
      <h2 className="font-display text-xl uppercase">Dostawca poczty</h2>
      <dl className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted-foreground">Dostawca</dt><dd>{data.provider.name}</dd>
        <dt className="text-muted-foreground">Adres nadawcy</dt><dd>{data.settings.sender_name} &lt;{data.settings.sender}&gt;</dd>
        <dt className="text-muted-foreground">Status domeny</dt>
        <dd>{data.provider.connected ? <span className="text-gold">Zweryfikowana</span> : <span className="text-destructive">Oczekuje na weryfikację</span>}</dd>
        <dt className="text-muted-foreground">Tryb wysyłki</dt>
        <dd>{live ? "Rzeczywista wysyłka" : "Tryb testowy — wiadomości są przechwytywane i widoczne w Historii wysyłek jako „Symulacja”, nic nie trafia do odbiorców"}</dd>
        <dt className="text-muted-foreground">Klucz API</dt><dd>Nie jest potrzebny — wbudowana poczta używa bezpiecznego połączenia serwera. Żaden klucz nie trafia do przeglądarki.</dd>
      </dl>
      {!data.provider.connected && (
        <div className="border-l-2 border-gold pl-3 text-foreground/80">
          <p className="font-semibold">Co trzeba zrobić, aby włączyć rzeczywistą wysyłkę:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>W ustawieniach projektu Lovable (Cloud → Emails) dodać domenę tatanabacznosci.pl jako domenę nadawcy.</li>
            <li>U rejestratora domeny dodać rekordy DNS wskazane w tym kreatorze i poczekać na weryfikację (do 72 godzin).</li>
            <li>Podłączyć wysyłkę w silniku powiadomień (jedna zmiana po stronie serwera) i przełączyć tryb na „Rzeczywista wysyłka”.</li>
          </ol>
          <p className="mt-1 text-xs text-muted-foreground">Szablony, zdarzenia i historia nie wymagają przebudowy.</p>
        </div>
      )}
      {data.canEdit && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="rt">Adres odpowiedzi (Reply-To)</Label><Input id="rt" type="email" value={rt} onChange={(e) => setReplyTo(e.target.value)} placeholder="kontakt@tatanabacznosci.pl" /></div>
          <div className="flex items-end gap-3"><Switch id="live" checked={live} disabled={!data.provider.connected || busy}
            onCheckedChange={(v) => act(async () => { await saveCfg({ data: { reply_to: rt, delivery_mode: v ? "live" : "test" } }); return v ? "Włączono rzeczywistą wysyłkę." : "Włączono tryb testowy."; })} />
            <Label htmlFor="live">Rzeczywista wysyłka{!data.provider.connected && " (niedostępna do czasu weryfikacji)"}</Label></div>
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => act(async () => { await saveCfg({ data: { reply_to: rt, delivery_mode: data.settings.delivery_mode } }); return "Zapisano adres odpowiedzi."; })}>Zapisz konfigurację dostawcy</Button>
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label htmlFor="tt">Wiadomość testowa</Label>
          <div className="flex gap-2"><Input id="tt" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="adres@example.com" />
            <Button type="button" variant="outline" disabled={busy || !to} onClick={() => act(async () => {
              const r = await test({ data: { key: "test_message", to } });
              if (r.status === "simulated") return "Tryb testowy: wiadomość przechwycona (symulacja), nie została wysłana.";
              if (r.status === "sent") return "Wiadomość testowa wysłana.";
              throw new Error(`Nie wysłano: ${r.reason ?? r.status}`);
            })}>Wyślij test</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => act(async () => {
              const r = await dup();
              if (r.second !== "duplicate") throw new Error(`Ochrona przed duplikatami nie zadziałała (druga próba: ${r.second}).`);
              return "Ochrona przed duplikatami działa: druga wysyłka z tym samym kluczem została zablokowana.";
            })}>Test duplikatów</Button></div>
        </div>
      </>}
    </section>
  );
}
