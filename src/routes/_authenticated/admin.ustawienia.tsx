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

type Form = { platform_name: string; contact_email: string; support_email: string; notice_enabled: boolean; maintenance_enabled: boolean; maintenance_message: string; social_youtube: string; social_spotify: string; social_tiktok: string; social_instagram: string;
  company_legal_name: string; company_legal_form: string; company_nip: string; company_regon: string; company_krs: string;
  company_address_street: string; company_address_postal: string; company_address_city: string; company_address_country: string;
  contact_phone: string; contact_hours: string;
  billing_same_as_company: boolean; billing_name: string; billing_nip: string; billing_address: string;
  footer_description: string; footer_copyright: string; footer_show_contact: boolean };

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
      social_youtube: s.social_youtube ?? "", social_spotify: s.social_spotify ?? "", social_tiktok: s.social_tiktok ?? "", social_instagram: s.social_instagram ?? "",
      company_legal_name: s.company_legal_name ?? "", company_legal_form: s.company_legal_form ?? "", company_nip: s.company_nip ?? "",
      company_regon: s.company_regon ?? "", company_krs: s.company_krs ?? "", company_address_street: s.company_address_street ?? "",
      company_address_postal: s.company_address_postal ?? "", company_address_city: s.company_address_city ?? "", company_address_country: s.company_address_country ?? "",
      contact_phone: s.contact_phone ?? "", contact_hours: s.contact_hours ?? "",
      billing_same_as_company: s.billing_same_as_company, billing_name: s.billing_name ?? "", billing_nip: s.billing_nip ?? "", billing_address: s.billing_address ?? "",
      footer_description: s.footer_description ?? "", footer_copyright: s.footer_copyright ?? "", footer_show_contact: s.footer_show_contact });
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
        <div className="space-y-2"><Label htmlFor="cp">Telefon kontaktowy</Label>
          <Input id="cp" disabled={ro} value={f.contact_phone} maxLength={20} onChange={(e) => set("contact_phone", e.target.value)} placeholder="np. +48 600 000 000" /></div>
        <div className="space-y-2"><Label htmlFor="ch">Godziny / opis dostępności</Label>
          <Input id="ch" disabled={ro} value={f.contact_hours} maxLength={200} onChange={(e) => set("contact_hours", e.target.value)} placeholder="np. Pon–Pt 9:00–17:00" /></div>
      </Section>

      <Section title="Dane firmy i podmiotu prawnego" hint="Wyświetlane w stopce i na stronie Kontakt tylko wtedy, gdy są uzupełnione. Puste pole = dane ukryte.">
        <div className="space-y-2"><Label htmlFor="cln">Pełna nazwa prawna</Label>
          <Input id="cln" disabled={ro} value={f.company_legal_name} maxLength={200} onChange={(e) => set("company_legal_name", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="clf">Forma prawna</Label>
          <Input id="clf" disabled={ro} value={f.company_legal_form} maxLength={100} onChange={(e) => set("company_legal_form", e.target.value)} placeholder="np. jednoosobowa działalność gospodarcza" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="nip">NIP</Label>
            <Input id="nip" disabled={ro} value={f.company_nip} maxLength={10} onChange={(e) => set("company_nip", e.target.value)} placeholder="10 cyfr" /></div>
          <div className="space-y-2"><Label htmlFor="regon">REGON</Label>
            <Input id="regon" disabled={ro} value={f.company_regon} maxLength={14} onChange={(e) => set("company_regon", e.target.value)} placeholder="9 lub 14 cyfr" /></div>
          <div className="space-y-2"><Label htmlFor="krs">KRS</Label>
            <Input id="krs" disabled={ro} value={f.company_krs} maxLength={10} onChange={(e) => set("company_krs", e.target.value)} placeholder="10 cyfr" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="cas">Ulica i numer</Label>
          <Input id="cas" disabled={ro} value={f.company_address_street} maxLength={200} onChange={(e) => set("company_address_street", e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="cap">Kod pocztowy</Label>
            <Input id="cap" disabled={ro} value={f.company_address_postal} maxLength={6} onChange={(e) => set("company_address_postal", e.target.value)} placeholder="00-000" /></div>
          <div className="space-y-2"><Label htmlFor="cac">Miejscowość</Label>
            <Input id="cac" disabled={ro} value={f.company_address_city} maxLength={100} onChange={(e) => set("company_address_city", e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="caco">Kraj</Label>
            <Input id="caco" disabled={ro} value={f.company_address_country} maxLength={100} onChange={(e) => set("company_address_country", e.target.value)} placeholder="np. Polska" /></div>
        </div>
      </Section>

      <Section title="Dane do faktur" hint="Te dane nie są publikowane na stronie — widzą je wyłącznie administratorzy.">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="bsac">Dane do faktury takie same jak dane podmiotu</Label>
          <Switch id="bsac" disabled={ro} checked={f.billing_same_as_company} onCheckedChange={(v) => set("billing_same_as_company", v)} /></div>
        {!f.billing_same_as_company && (
          <>
            <div className="space-y-2"><Label htmlFor="bn">Nazwa nabywcy na fakturze</Label>
              <Input id="bn" disabled={ro} value={f.billing_name} maxLength={200} onChange={(e) => set("billing_name", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="bnip">NIP nabywcy</Label>
              <Input id="bnip" disabled={ro} value={f.billing_nip} maxLength={10} onChange={(e) => set("billing_nip", e.target.value)} placeholder="10 cyfr" /></div>
            <div className="space-y-2"><Label htmlFor="ba">Adres do faktury</Label>
              <Textarea id="ba" disabled={ro} rows={2} maxLength={300} value={f.billing_address} onChange={(e) => set("billing_address", e.target.value)} /></div>
          </>
        )}
      </Section>

      <Section title="Stopka strony" hint="Puste pola oznaczają dotychczasowe teksty domyślne.">
        <div className="space-y-2"><Label htmlFor="fd">Opis marki pod logo</Label>
          <Textarea id="fd" disabled={ro} rows={3} maxLength={500} value={f.footer_description} onChange={(e) => set("footer_description", e.target.value)} placeholder="Puste = dotychczasowy opis" /></div>
        <div className="space-y-2"><Label htmlFor="fc">Tekst praw autorskich</Label>
          <Input id="fc" disabled={ro} value={f.footer_copyright} maxLength={200} onChange={(e) => set("footer_copyright", e.target.value)} placeholder="Puste = „Wszelkie prawa zastrzeżone.”" /></div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="fsc">Pokaż kolumnę kontaktową w stopce</Label>
          <Switch id="fsc" disabled={ro} checked={f.footer_show_contact} onCheckedChange={(v) => set("footer_show_contact", v)} /></div>
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
