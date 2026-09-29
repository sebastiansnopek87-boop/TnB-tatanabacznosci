import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { startLibraryCheckout, cancelLibraryCheckout } from "@/lib/orders.functions";
import { fmtPrice } from "@/lib/library";

const input = "w-full border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none";

export function BuyPanel({ slug, title, price }: { slug: string; title: string; price: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{ secret: string; orderId: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user; if (!u) return;
      const m = (u.user_metadata ?? {}) as Record<string, string>;
      setEmail((e) => e || u.email || "");
      setName((n) => n || [m["first_name"], m["last_name"]].filter(Boolean).join(" ") || m["full_name"] || m["name"] || "");
    });
  }, [open]);

  async function pay(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (name.trim().length < 3) return setErr("Podaj imię i nazwisko.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Podaj poprawny adres e-mail.");
    if (!consent) return setErr("Zaakceptuj wymagane zgody.");
    setBusy(true);
    try {
      const r = await startLibraryCheckout({ data: { slug, name, email, consent: true, environment: getStripeEnvironment(), origin: window.location.origin } });
      if ("error" in r) throw new Error(r.error);
      setCheckout({ secret: r.clientSecret, orderId: r.orderId });
    } catch (x) { setErr(x instanceof Error ? x.message : "Nie udało się rozpocząć płatności."); }
    finally { setBusy(false); }
  }

  async function abort() {
    if (checkout) cancelLibraryCheckout({ data: { orderId: checkout.orderId, environment: getStripeEnvironment() } }).catch(() => {});
    setCheckout(null);
  }

  const options = useMemo(() => (checkout ? { fetchClientSecret: async () => checkout.secret } : null), [checkout]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="mt-6 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Kup materiał</button>
  );

  if (checkout && options) return (
    <div className="mt-6">
      <div className="bg-background p-1"><EmbeddedCheckoutProvider stripe={getStripe()} options={options}><EmbeddedCheckout /></EmbeddedCheckoutProvider></div>
      <button type="button" onClick={abort} className="mt-4 text-sm text-gold underline">Anuluj płatność i wróć</button>
    </div>
  );

  return (
    <form onSubmit={pay} className="mt-6 space-y-4" noValidate>
      <p className="eyebrow text-gold">Zamówienie</p>
      <label className="block text-sm text-foreground/85">Imię i nazwisko
        <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" required />
      </label>
      <label className="block text-sm text-foreground/85">Adres e-mail, na który wyślemy materiał
        <input className={`${input} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required />
      </label>
      <div className="border border-border/60 bg-card p-4 text-sm">
        <p className="text-muted-foreground">Podsumowanie</p>
        <div className="mt-2 flex items-start justify-between gap-4"><span className="break-words text-foreground">{title}</span><span className="shrink-0 text-foreground">{fmtPrice(price)}</span></div>
        <div className="mt-3 flex justify-between border-t border-border/60 pt-3 font-semibold text-foreground"><span>Do zapłaty (PLN)</span><span className="text-gold">{fmtPrice(price)}</span></div>
      </div>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/80">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
        <span>Akceptuję <Link to="/regulamin" className="text-gold underline">Regulamin</Link> i <Link to="/polityka-prywatnosci" className="text-gold underline">Politykę prywatności</Link>. Wyrażam zgodę na przetwarzanie imienia, nazwiska i adresu e-mail w celu realizacji zamówienia i dostarczenia materiału. *</span>
      </label>
      <p className="text-xs text-muted-foreground">Konto nie jest wymagane. Dane płatnicze obsługuje bezpiecznie operator płatności — nie przechowujemy danych kart.</p>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60">{busy ? "Przygotowywanie…" : `Przejdź do płatności — ${fmtPrice(price)}`}</button>
        <button type="button" onClick={() => setOpen(false)} className="border border-border/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground/80">Anuluj</button>
      </div>
    </form>
  );
}
