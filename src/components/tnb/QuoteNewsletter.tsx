import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { HOME_ASSETS } from "@/lib/home-assets";
import { legacySection } from "@/lib/home-legacy";
import { Txt, editAttrs, type BlockProps } from "./home-edit";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { NEWSLETTER_CONSENT_TEXT, newsletterSchema, subscribeNewsletter } from "@/lib/newsletter.functions";

const MESSAGES = {
  subscribed: "Dziękujemy! Twój adres został zapisany do newslettera.",
  resubscribed: "Witamy ponownie! Subskrypcja została wznowiona.",
  already: "Ten adres jest już zapisany do newslettera.",
  pending: "Sprawdź skrzynkę i potwierdź zapis, klikając link w wiadomości.",
} as const;

export function QuoteNewsletter({ s = legacySection("quote-newsletter"), sel, imageSrc }: BlockProps) {
  const a = editAttrs(sel);
  const src = (s.image && imageSrc?.(s.image)) || HOME_ASSETS["banner"]!.src;
  const { visible } = useModuleVisibility();
  const send = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const startedAt = useRef(Date.now());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = newsletterSchema.safeParse({ email, consent });
    if (!parsed.success) {
      setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Sprawdź formularz." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await send({ data: { ...parsed.data, website: honeypot, elapsedMs: Date.now() - startedAt.current } });
      setMsg({ ok: true, text: MESSAGES[r.status] });
      setEmail("");
      setConsent(false);
    } catch (err) {
      const m = err instanceof Error && /Zbyt wiele|antyspam/.test(err.message) ? err.message : "Nie udało się zapisać adresu. Spróbuj ponownie za chwilę.";
      setMsg({ ok: false, text: m });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`grid gap-px bg-border/40 ${visible("newsletter") ? "lg:grid-cols-[1.55fr_1fr]" : ""}`}>
      <div className="relative isolate flex items-center overflow-hidden px-5 py-16 sm:py-20 lg:px-14 lg:py-28">
        <img {...a("image")} src={src} loading="lazy" decoding="async" alt={s.decorative ? "" : s.imageAlt} className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.132 0.01 58 / 0.95) 0%, oklch(0.132 0.01 58 / 0.7) 55%, oklch(0.132 0.01 58 / 0.45) 100%)",
          }}
        />
        <div className="border-l-2 border-gold pl-7">
          <p {...a("body")} className="whitespace-pre-line font-display text-[1.2rem] leading-[1.7] text-foreground sm:text-[1.45rem]"><Txt s={s} k="body" text={s.body} /></p>
          {s.quoteAuthor && <p {...a("quoteAuthor")} className="eyebrow mt-5 text-gold"><Txt s={s} k="quoteAuthor" text={s.quoteAuthor} /></p>}
        </div>
      </div>

      {visible("newsletter") && <div className="flex items-center gap-6 bg-surface-deep px-5 py-14 lg:px-14 lg:py-28">
        <Mail className="hidden h-10 w-10 shrink-0 text-foreground/80 sm:block" strokeWidth={1} />
        <div className="w-full">
          <h2 {...a("heading")} className="text-[0.82rem] uppercase tracking-[0.16em] text-gold"><Txt s={s} k="heading" text={s.heading} /></h2>
          {s.caption && <p {...a("caption")} className="mt-2 text-[0.82rem] leading-[1.6] text-muted-foreground"><Txt s={s} k="caption" text={s.caption} /></p>}
          <form onSubmit={handleSubmit} noValidate className="mt-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Twój e-mail"
                aria-label="Twój e-mail"
                className="min-w-[12rem] flex-1 border border-border bg-background/60 px-4 py-3 text-[0.85rem] text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-6 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright disabled:opacity-60"
              >
                {busy ? "Zapisywanie…" : "Zapisz się"}
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" strokeWidth={2} />}
              </button>
            </div>
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[0.75rem] leading-[1.5] text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-gold)]" />
              <span>
                {NEWSLETTER_CONSENT_TEXT}{" "}
                <Link to="/polityka-prywatnosci" className="text-gold hover:underline">Polityka prywatności</Link>.
              </span>
            </label>
            {msg && (
              <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-[0.8rem] ${msg.ok ? "text-gold" : "text-destructive"}`}>
                {msg.text}
              </p>
            )}
          </form>
          <p className="mt-3 flex items-center gap-2 text-[0.75rem] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            Bez spamu. Tylko wartościowe treści.{" "}
            <Link to="/newsletter/wypisz" className="underline-offset-4 hover:text-gold hover:underline">Wypisz się</Link>
          </p>
        </div>
      </div>}
    </section>
  );
}
