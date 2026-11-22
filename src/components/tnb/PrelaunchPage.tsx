import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import logo from "@/assets/logo-384.webp.asset.json";
import { useBrand, brandSrc } from "@/hooks/use-brand-settings";
import { PRELAUNCH_CONSENT_TEXT, prelaunchSignupSchema, signupPrelaunch } from "@/lib/api/prelaunch";

const MESSAGES = {
  subscribed: "Zapisano. Otrzymasz jednorazową informację o uruchomieniu TNB.",
  reactivated: "Twój zapis został wznowiony. Otrzymasz jednorazową informację o starcie.",
  already: "Ten adres jest już na liście osób oczekujących.",
} as const;


export function PrelaunchPage({ message, platformName }: { message: string; platformName: string }) {
  const brand = useBrand();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [unsubscribeToken, setUnsubscribeToken] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const logoSrc = (brand?.logo && brandSrc(brand.logo)) || logo.url;


  async function submit(e: FormEvent) {
    e.preventDefault();
    if (firstName.trim().length < 2) {
      setResult({ ok: false, text: "Wpisz swoje imię." });
      return;
    }
    const parsed = prelaunchSignupSchema.safeParse({ first_name: firstName, email, consent });
    if (!parsed.success) {
      setResult({ ok: false, text: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await signupPrelaunch({
        data: { ...parsed.data, website: honeypot, elapsedMs: Date.now() - startedAt.current },
      });
      if (response.unsubscribeToken) {
        setUnsubscribeToken(response.unsubscribeToken);
      }
      setResult({ ok: true, text: MESSAGES[response.status] });
      setFirstName("");
      setEmail("");
      setConsent(false);
    } catch (error) {
      const message = error instanceof Error && /Zbyt wiele|antyspam/.test(error.message)
        ? error.message
        : "Nie udało się zapisać. Spróbuj ponownie za chwilę.";
      setResult({ ok: false, text: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-[#171613] px-5 py-14 text-[#f4f0e7]">
      <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_78%_18%,rgba(160,119,66,0.2),transparent_42%),radial-gradient(ellipse_at_12%_88%,rgba(160,119,66,0.12),transparent_38%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
        <section className="max-w-2xl">
          <div className="flex items-center gap-4">
            <img src={logoSrc} alt="Logo Tata Na Baczności" className="h-20 w-20 object-contain sm:h-24 sm:w-24" />
            <div>
              <p className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-[#c49a61] sm:text-2xl">{brand?.site_name || platformName}</p>
              {brand?.slogan && <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#c5b9a5]">{brand.slogan}</p>}
            </div>
          </div>
          <p className="mt-16 text-xs font-semibold uppercase tracking-[0.28em] text-[#c49a61]">Przedpremiera · Tata Na Baczności</p>
          <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold uppercase leading-[0.98] tracking-[0.015em] sm:text-7xl">
            {brand?.public_title || <>Tu powstaje <span className="text-[#c49a61]">coś ważnego.</span></>}
          </h1>
          <p className="mt-8 max-w-xl whitespace-pre-line text-base leading-8 text-[#d1c9bb] sm:text-lg">
            {message || brand?.public_description || "Pracujemy nad miejscem, w którym będzie można znaleźć prawdziwe rozmowy o ojcostwie, rodzinie, odpowiedzialności i życiu. Jeszcze chwila cierpliwości."}
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-[#c49a61]">
            <span className="h-px w-12 bg-[#a77d49]" />
            <span className="uppercase tracking-[0.18em]">Pracujemy nad uruchomieniem</span>
          </div>
        </section>

        <section className="border border-[#a77d49]/45 bg-[#211f1a]/90 p-6 shadow-2xl shadow-black/30 sm:p-9">
          <div className="flex items-center gap-3 text-[#c49a61]">
            <Mail className="h-5 w-5" strokeWidth={1.5} />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Bądź wśród pierwszych</p>
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold uppercase leading-tight sm:text-4xl">Daj znać, że czekasz.</h2>
          <p className="mt-4 text-sm leading-7 text-[#c5bdae]">Zostaw imię i adres e-mail. Dodamy Cię do listy osób, które chcą otrzymać informację o uruchomieniu TNB.</p>
          <form onSubmit={submit} noValidate className="mt-8 space-y-4">
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="prelaunch-website">Strona internetowa</label>
              <input id="prelaunch-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.12em] text-[#c5bdae]">Twoje imię</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={100} required placeholder="Jak masz na imię?" className="w-full border border-[#6e6556] bg-[#171613] px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-[#81796d] focus:border-[#c49a61]" />
            </label>
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.12em] text-[#c5bdae]">Adres e-mail</span>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setResult(null); setUnsubscribeToken(null); }} autoComplete="email" maxLength={255} required placeholder="twoj@email.pl" className="w-full border border-[#6e6556] bg-[#171613] px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-[#81796d] focus:border-[#c49a61]" />
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[#bdb4a6]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[#c49a61]" />
              <span>{PRELAUNCH_CONSENT_TEXT} <Link to="/polityka-prywatnosci" className="text-[#c49a61] underline underline-offset-2">Polityka prywatności</Link>.</span>
            </label>
            <button type="submit" disabled={busy} className="flex w-full items-center justify-between bg-[#b58a52] px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#171613] transition-colors hover:bg-[#d0a66e] disabled:cursor-wait disabled:opacity-60">
              {busy ? "Zapisywanie…" : "Dołącz do listy oczekujących"}
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
            {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "flex items-start gap-2 text-sm text-[#d6b47e]" : "text-sm text-red-300"}>{result.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{result.text}</p>}
            {result?.ok && unsubscribeToken && <Link to="/przedpremiera/wypisz" search={{ token: unsubscribeToken }} className="inline-block text-xs text-[#c49a61] underline underline-offset-4">Wycofaj zgodę i usuń mój zapis</Link>}
          </form>
          <p className="mt-6 text-[11px] leading-5 text-[#82796d]">Adres wykorzystamy wyłącznie do jednorazowej informacji o uruchomieniu TNB. Zapis nie oznacza subskrypcji newslettera. Link do wycofania zgody pojawi się po zapisie; jeśli go utracisz, skontaktuj się z nami przez formularz kontaktowy.</p>
        </section>
      </div>
      <Link to="/auth" className="absolute bottom-5 right-5 text-[10px] uppercase tracking-[0.16em] text-[#82796d] transition-colors hover:text-[#c49a61]">Panel administratora</Link>
    </main>
  );
}
