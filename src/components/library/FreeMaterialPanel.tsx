import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { requestFreeMaterial, redeemFreeMaterial } from "@/lib/library-delivery.functions";
import { FREE_CONSENT_TEXT, type FreeDelivery } from "@/lib/library";

const input = "mt-1 w-full border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none";

export function FreeMaterialPanel({ slug, mode }: { slug: string; mode: Exclude<FreeDelivery, "direct"> }) {
  const req = useServerFn(requestFreeMaterial);
  const redeem = useServerFn(redeemFreeMaterial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", consent: false, website: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { url?: string }>(null);
  const opened = useRef(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setErr(null);
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Podaj imię i nazwisko.");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.trim())) return setErr("Podaj poprawny adres e-mail.");
    if (!f.consent) return setErr("Zaakceptuj informację o przetwarzaniu danych.");
    setBusy(true);
    try {
      const r = await req({ data: { slug, firstName: f.firstName, lastName: f.lastName, email: f.email, consent: true, website: f.website, elapsedMs: Date.now() - opened.current } });
      if (r.mode === "form_download") {
        const d = await redeem({ data: { token: r.token } });
        setDone(d.status === "ok" ? { url: d.url } : {});
        if (d.status !== "ok") setErr("Materiał jest chwilowo niedostępny.");
      } else setDone({});
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      try { setErr(JSON.parse(m)[0]?.message ?? m); } catch { setErr(m || "Nie udało się wysłać formularza."); }
    } finally { setBusy(false); }
  }

  const label = mode === "email" ? "Wyślij mi bezpłatny materiał" : "Odbierz bezpłatny materiał";
  if (done) return (
    <div className="mt-6 space-y-3">
      {mode === "email"
        ? <p className="text-[0.95rem] text-foreground/85">Dziękujemy. Przyjęliśmy zgłoszenie — jeśli adres jest poprawny, wkrótce otrzymasz wiadomość z linkiem do pobrania (ważnym 72 godziny).</p>
        : done.url ? (<>
            <p className="text-[0.95rem] text-foreground/85">Gotowe. Materiał możesz pobrać teraz.</p>
            <a href={done.url} className="inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Pobierz PDF</a>
          </>) : null}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">Newsletter TNB to osobna, dobrowolna subskrypcja — ten formularz Cię na niego nie zapisuje.</p>
    </div>
  );
  if (!open) return <button type="button" onClick={() => { setOpen(true); opened.current = Date.now(); }} className="mt-6 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">{label}</button>;

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Imię<input className={input} value={f.firstName} maxLength={60} autoComplete="given-name" onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
        <label className="block text-sm">Nazwisko<input className={input} value={f.lastName} maxLength={80} autoComplete="family-name" onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
      </div>
      <label className="block text-sm">Adres e-mail<input type="email" className={input} value={f.email} maxLength={254} autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <input tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} name="website" />
      <p className="text-xs leading-relaxed text-muted-foreground">Administratorem danych jest TATA NA BACZNOŚCI (kontakt@tatanabacznosci.pl). Dane wykorzystamy wyłącznie do {mode === "email" ? "wysłania" : "udostępnienia"} tego materiału i przechowamy do 12 miesięcy. Szczegóły: <Link to="/polityka-prywatnosci" className="text-gold underline">Polityka prywatności</Link>.</p>
      <label className="flex items-start gap-2 text-sm text-foreground/85"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /><span>{FREE_CONSENT_TEXT} *</span></label>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <button type="submit" disabled={busy} className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60">{busy ? "Wysyłanie…" : label}</button>
      <p className="text-xs text-muted-foreground">Zgoda marketingowa nie jest wymagana. Newsletter to osobna, dobrowolna subskrypcja.</p>
    </form>
  );
}
