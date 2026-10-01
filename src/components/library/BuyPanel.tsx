import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createLibraryOrder, getCheckoutOptions, recoverAccess } from "@/lib/orders.functions";
import { fmtPrice } from "@/lib/library";
import { BANK_METHOD, type PaymentMethodId } from "@/config/payments";
import { useAuth } from "@/hooks/use-auth";

const input = "w-full border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none";
const btn = "bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60";
const btn2 = "border border-border/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground/80";

export function BuyPanel({ slug, title, price }: { slug: string; title: string; price: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethodId | null>(null);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = useQuery({ queryKey: ["checkout-options"], queryFn: () => getCheckoutOptions(), enabled: open });
  const methods = [...(opts.data?.providers ?? []).map((p) => ({ id: p.id as PaymentMethodId, label: `Płatność online — ${p.label}`, note: p.test ? "Tryb testowy operatora: nie zostaną pobrane prawdziwe środki." : "Zostaniesz przekierowany do bezpiecznej płatności u operatora.", isDefault: p.isDefault })), { ...BANK_METHOD, isDefault: false }];
  const label = methods.find((m) => m.id === method)?.label ?? "";

  useEffect(() => {
    if (!open || !user) return;
    const m = (user.user_metadata ?? {}) as Record<string, string>;
    setEmail((e) => e || user.email || "");
    setName((n) => n || [m["first_name"], m["last_name"]].filter(Boolean).join(" ") || m["full_name"] || m["name"] || "");
  }, [open, user]);
  useEffect(() => {
    if (method || !opts.data) return;
    setMethod((opts.data.providers.find((p) => p.isDefault) ?? opts.data.providers[0])?.id ?? "bank_transfer");
  }, [opts.data, method]);

  function review(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (name.trim().length < 3) return setErr("Podaj imię i nazwisko.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Podaj poprawny adres e-mail.");
    if (phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) return setErr("Podaj poprawny numer telefonu.");
    if (!method || !methods.some((m) => m.id === method)) return setErr("Wybierz dostępną metodę płatności.");
    if (!consent) return setErr("Zaakceptuj warunki zakupu i politykę prywatności.");
    setStep("review");
  }

  async function submit() {
    setErr(null); setBusy(true);
    try {
      const r = await createLibraryOrder({ data: { slug, name, email, phone, method: method!, consent: true } });
      if ("error" in r) throw new Error(r.error);
      if (r.redirectUrl) { window.location.href = r.redirectUrl; return; }
      navigate({ to: "/zakup/$token", params: { token: r.token } });
    } catch (x) { setErr(x instanceof Error ? x.message : "Nie udało się złożyć zamówienia."); setBusy(false); }
  }

  if (!open) return (<><button type="button" onClick={() => setOpen(true)} className={`mt-6 ${btn}`}>Kup materiał</button><Recover /></>);

  if (step === "review") {
    const row = (k: string, v: string) => <div className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2"><span className="text-muted-foreground">{k}</span><span className="break-all text-right text-foreground">{v}</span></div>;
    return (
      <div className="mt-6 space-y-4">
        <p className="eyebrow text-gold">Sprawdź zamówienie</p>
        <div className="border border-border/60 bg-card p-4 text-sm">
          {row("Materiał", title)}{row("Imię i nazwisko", name.trim())}{row("E-mail", email.trim())}{row("Telefon", phone.trim() || "—")}
          {row("Metoda płatności", label)}
          <div className="mt-3 flex justify-between font-semibold"><span>Do zapłaty (PLN)</span><span className="text-gold">{fmtPrice(price)}</span></div>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={submit} disabled={busy} className={btn}>{busy ? (method === "bank_transfer" ? "Składanie zamówienia…" : "Łączenie z operatorem…") : method === "bank_transfer" ? "Zamawiam z obowiązkiem zapłaty" : "Zamawiam i przechodzę do płatności"}</button>
          <button type="button" onClick={() => setStep("form")} disabled={busy} className={btn2}>Popraw dane</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="mt-6 space-y-4" noValidate>
      <p className="eyebrow text-gold">Zamówienie</p>
      <label className="block text-sm text-foreground/85">Imię i nazwisko *
        <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
      </label>
      <label className="block text-sm text-foreground/85">Adres e-mail, na który wyślemy dostęp *
        <input className={`${input} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
      </label>
      <label className="block text-sm text-foreground/85">Numer telefonu (opcjonalnie)
        <input className={`${input} mt-1`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" />
      </label>
      <div className="border border-border/60 bg-card p-4 text-sm">
        <div className="flex items-start justify-between gap-4"><span className="break-words text-foreground">{title}</span><span className="shrink-0 text-gold">{fmtPrice(price)}</span></div>
      </div>
      <fieldset>
        <legend className="text-sm text-foreground/85">Metoda płatności *</legend>
        {opts.isLoading ? <p className="mt-2 text-xs text-muted-foreground">Wczytywanie metod płatności…</p> : (
          <div className="mt-2 space-y-2">
            {methods.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-3 border p-3 ${method === m.id ? "border-gold" : "border-border/60"}`}>
                <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
                <span><span className="block text-[0.95rem] font-medium text-foreground">{m.label}</span><span className="block text-xs text-muted-foreground">{m.note}</span></span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/80">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
        <span>Przeczytałem/am i akceptuję <Link to="/regulamin" className="text-gold underline">Regulamin</Link> oraz <Link to="/polityka-prywatnosci" className="text-gold underline">Politykę prywatności</Link>. Wyrażam zgodę na przetwarzanie moich danych w celu realizacji zamówienia i dostarczenia materiału. *</span>
      </label>
      <p className="text-xs text-muted-foreground">Konto nie jest wymagane. {user ? "Zakup zostanie przypisany do Twojego konta." : "Jeśli później założysz konto na ten sam adres e-mail, zakup pojawi się w Moim TNB."}</p>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={btn}>Przejdź do podsumowania</button>
        <button type="button" onClick={() => setOpen(false)} className={btn2}>Anuluj</button>
      </div>
    </form>
  );
}

// Buyer recovery of a lost access link (e-mail + order number).
function Recover() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""); const [number, setNumber] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 block text-xs text-gold underline">Kupiłeś już ten materiał? Odzyskaj dostęp</button>;
  return (
    <form className="mt-4 space-y-2 border border-border/60 p-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      try { await recoverAccess({ data: { email, number } }); setMsg("Jeśli dane pasują do opłaconego zamówienia, wyślemy na ten adres nowy link do materiału."); }
      catch { setMsg("Sprawdź adres e-mail i numer zamówienia (np. TNB-2026-12)."); }
      setBusy(false);
    }}>
      <p className="text-sm">Podaj adres e-mail z zamówienia i jego numer.</p>
      <input className={input} type="email" placeholder="Adres e-mail" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
      <input className={input} placeholder="Numer zamówienia, np. TNB-2026-12" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={30} required />
      <button className={btn2} disabled={busy}>{busy ? "Wysyłanie…" : "Wyślij link ponownie"}</button>
      {msg && <p className="text-xs text-muted-foreground" role="status">{msg}</p>}
    </form>
  );
}
