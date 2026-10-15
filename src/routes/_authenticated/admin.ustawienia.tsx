import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform.functions";
import { fmtDate, errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ModuleVisibilitySettings } from "@/components/admin/ModuleVisibility";
import { BrandSettings } from "@/components/admin/BrandSettings";
import { VisualEffectsSettings } from "@/components/admin/VisualEffectsSettings";

export const Route = createFileRoute("/_authenticated/admin/ustawienia")({
  head: () => ({ meta: [
    { title: "Ustawienia platformy — Tata Na Baczności" },
    { name: "description", content: "Ustawienia i widoczność modułów Tata Na Baczności." },
    { property: "og:title", content: "Ustawienia platformy — Tata Na Baczności" },
    { property: "og:description", content: "Ustawienia i widoczność modułów TNB." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PlatformSettings });

type Form = { platform_name: string; contact_email: string; support_email: string; notice_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string; social_youtube: string; social_spotify: string; social_tiktok: string; social_instagram: string };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border border-border/60 p-4 sm:p-5">
      <div><h2 className="font-display text-xl font-semibold uppercase">{title}</h2>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
    </section>
  );
}

function PlatformSettings() {
  const get = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-platform-settings"], queryFn: () => get() });
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const s = data.settings;
    setF({ platform_name: s.platform_name, contact_email: s.contact_email ?? "", support_email: s.support_email ?? "",
      notice_enabled: s.notice_enabled, maintenance_enabled: s.maintenance_enabled, maintenance_message: s.maintenance_message,
      social_youtube: s.social_youtube ?? "", social_spotify: s.social_spotify ?? "", social_tiktok: s.social_tiktok ?? "", social_instagram: s.social_instagram ?? "" });
  }, [data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    if (f.maintenance_enabled && !data?.settings.maintenance_enabled &&
      !window.confirm("Włączyć tryb konserwacji? Odwiedzający zobaczą ekran przerwy technicznej. Panel i logowanie pozostaną dostępne.")) return;
    setBusy(true); setErr(null);
    try {
      await save({ data: f });
      toast.success("Zmiany zapisane.");
      qc.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-settings-public"] });
    } catch (e) {
      let text = errMsg(e);
      try { const p = JSON.parse((e as Error).message); if (Array.isArray(p)) text = p.map((i: { message: string }) => i.message).join(" · "); } catch { /* plain */ }
      setErr(text); toast.error("Nie zapisano zmian.");
    } finally { setBusy(false); }
  }

  if (error) return <p className="text-sm text-destructive">{errMsg(error)}</p>;
  if (!f || !data) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  const ro = !data.canEdit;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const em = data.email;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold uppercase">Ustawienia platformy</h1>
      {ro && <p className="border border-gold/50 p-3 text-sm">Tryb podglądu. Zmieniać ustawienia może tylko superadministrator.</p>}
      <BrandSettings canEdit={!ro} />

      <ModuleVisibilitySettings value={data.settings.module_visibility} canEdit={!ro} />

      <VisualEffectsSettings value={(data.settings as any).visual_effects} canEdit={!ro} />

      <Section title="Podstawowe informacje" hint="Nazwa pojawia się w stopce strony i na ekranie przerwy technicznej.">
        <div className="space-y-2"><Label htmlFor="pn">Nazwa platformy</Label>
          <Input id="pn" disabled={ro} value={f.platform_name} maxLength={100} onChange={(e) => set("platform_name", e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">Adres strony: ustala go publikacja i ewentualna własna domena. Nie jest to ustawienie panelu.</p>
      </Section>

      <Section title="Kontakt" hint="Adresy pokazują się w stopce i na stronie Kontakt. Puste pole = adres ukryty.">
        <div className="space-y-2"><Label htmlFor="ce">Podstawowy adres e-mail do kontaktu</Label>
          <Input id="ce" type="email" disabled={ro} value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="np. kontakt@twojadomena.pl" /></div>
        <div className="space-y-2"><Label htmlFor="se">Adres e-mail do obsługi użytkowników</Label>
          <Input id="se" type="email" disabled={ro} value={f.support_email} onChange={(e) => set("support_email", e.target.value)} placeholder="np. pomoc@twojadomena.pl" /></div>
      </Section>

      <Section title="Oficjalne kanały" hint="Używane na stronie Głos TNB. Puste pole = kanał nie jest pokazywany. Wpisz pełny adres https://.">
        {([["social_youtube", "YouTube"], ["social_spotify", "Spotify"], ["social_tiktok", "TikTok"], ["social_instagram", "Instagram"]] as const).map(([k, l]) => (
          <div key={k} className="space-y-2"><Label htmlFor={k}>{l}</Label>
            <Input id={k} type="url" disabled={ro} value={f[k]} maxLength={500} onChange={(e) => set(k, e.target.value)} placeholder="https://…" /></div>
        ))}
      </Section>

      <Section title="Poczta i powiadomienia" hint="Te ustawienia mają własną zakładkę — nie są powielane tutaj.">
        <ul className="space-y-1 text-sm text-foreground/80">
          <li>Nadawca: {em ? `${em.sender_name} <${em.sender_local_part}@${em.sender_domain || "…"}>` : "—"}</li>
          <li>Odbiorca powiadomień: {em?.notification_recipient ? "ustawiony" : "nieustawiony"}</li>
          <li>Powiadomienia o wiadomościach: {em?.contact_notifications_enabled ? "włączone" : "wyłączone"}; o zapisach do newslettera: {em?.newsletter_notifications_enabled ? "włączone" : "wyłączone"}</li>
          <li className="text-destructive">Wysyłka nieaktywna — brakuje podłączonego dostawcy poczty i zweryfikowanej domeny nadawcy.</li>
        </ul>
        <Link to="/admin/ustawienia-email" className="text-sm text-gold underline">Przejdź do ustawień powiadomień</Link>
      </Section>

      <Section title="Przerwa techniczna" hint="Panel administratora i logowanie zawsze pozostają dostępne.">
        <div className="space-y-2"><Label htmlFor="mm">Komunikat o przerwie technicznej</Label>
          <Textarea id="mm" disabled={ro} rows={3} maxLength={500} value={f.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} placeholder="np. Trwają prace techniczne. Wracamy około 22:00." /></div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ne">Pokaż komunikat jako pasek nad stroną</Label>
          <Switch id="ne" disabled={ro} checked={f.notice_enabled} onCheckedChange={(v) => set("notice_enabled", v)} /></div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="me">Tryb konserwacji (odwiedzający widzą tylko komunikat)</Label>
          <Switch id="me" disabled={ro} checked={f.maintenance_enabled} onCheckedChange={(v) => set("maintenance_enabled", v)} /></div>
        <p className="text-xs text-muted-foreground">Tryb konserwacji zasłania strony w przeglądarce. Administratorzy widzą stronę normalnie, z paskiem informacyjnym.</p>
      </Section>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap items-center gap-4">
        {!ro && <Button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz zmiany"}</Button>}
        <span className="text-xs text-muted-foreground">Ostatnia zmiana: {fmtDate(data.settings.updated_at)}</span>
      </div>
    </form>
  );
}
