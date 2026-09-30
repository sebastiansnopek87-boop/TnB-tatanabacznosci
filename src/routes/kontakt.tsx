import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Loader2, Mail, Phone } from "lucide-react";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { SocialIcon } from "@/components/tnb/SocialIcon";
import { getSiteSettings, visibleSocial } from "@/config/site-settings";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { contactSchema, submitContact } from "@/lib/contact.functions";

const DESC = "Napisz do Tata Na Baczności — pytania, historie, propozycje współpracy.";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — Tata Na Baczności" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Kontakt — Tata Na Baczności" },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ContactPage,
});

type Fields = { name: string; email: string; subject: string; message: string; privacy: boolean };
const EMPTY: Fields = { name: "", email: "", subject: "", message: "", privacy: false };

const inputCls =
  "w-full border border-border bg-background/60 px-4 py-3 text-[0.9rem] text-foreground placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none aria-[invalid=true]:border-destructive";

function ContactPage() {
  const s = getSiteSettings();
  const t = s.contactPage;
  const social = visibleSocial(s);
  const { data: ps } = usePlatformSettings();
  const { phone } = s.contact;
  const email = ps?.contact_email ?? s.contact.email;
  const support = ps?.support_email ?? null;
  const hasData = !!email || !!support || !!phone || social.length > 0;

  const send = useServerFn(submitContact);
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [honeypot, setHoneypot] = useState("");
  const startedAt = useRef(Date.now());

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(f);
    if (!parsed.success) {
      const errs: Partial<Record<keyof Fields, string>> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof Fields;
        if (!errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      return;
    }
    setStatus("sending");
    try {
      await send({ data: { ...parsed.data, website: honeypot, elapsedMs: Date.now() - startedAt.current } });
      setStatus("sent");
      setF(EMPTY);
    } catch {
      setStatus("error");
    }
  }

  return (
    <PageShell>
      <PageHeading eyebrow={t.eyebrow} title={t.title} intro={t.intro} />
      <div className={`grid gap-12 px-5 py-14 lg:px-14 lg:py-20 ${hasData ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
        <section className="max-w-2xl">
          <h2 className="font-display text-[1.8rem] font-medium uppercase tracking-[0.02em] text-foreground">
            {t.formTitle}
          </h2>

          {status === "sent" ? (
            <div role="status" className="mt-8 flex gap-4 border border-gold/60 bg-surface p-6">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-gold" strokeWidth={1.5} />
              <div>
                <p className="text-[0.95rem] text-foreground">{t.successMessage}</p>
                <button
                  onClick={() => {
                    setStatus("idle");
                    startedAt.current = Date.now();
                  }}
                  className="mt-4 text-[0.75rem] uppercase tracking-[0.16em] text-gold hover:text-gold-bright"
                >
                  Wyślij kolejną wiadomość
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Imię" error={errors.name}>
                  <input className={inputCls} value={f.name} maxLength={100} aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} autoComplete="given-name" />
                </Field>
                <Field label="Adres e-mail" error={errors.email}>
                  <input type="email" className={inputCls} value={f.email} maxLength={255} aria-invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                </Field>
              </div>
              <Field label="Temat wiadomości" error={errors.subject}>
                <input className={inputCls} value={f.subject} maxLength={150} aria-invalid={!!errors.subject} onChange={(e) => set("subject", e.target.value)} />
              </Field>
              <Field label="Treść wiadomości" error={errors.message}>
                <textarea rows={7} className={inputCls} value={f.message} maxLength={3000} aria-invalid={!!errors.message} onChange={(e) => set("message", e.target.value)} />
              </Field>

              {/* honeypot – hidden from people */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Strona www
                  <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </label>
              </div>

              <div>
                <label className="flex cursor-pointer items-start gap-3 text-[0.85rem] leading-[1.6] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={f.privacy}
                    onChange={(e) => set("privacy", e.target.checked)}
                    aria-invalid={!!errors.privacy}
                    className="mt-1 h-4 w-4 accent-[var(--color-gold)]"
                  />
                  <span>
                    Zapoznałem się z{" "}
                    <Link to="/polityka-prywatnosci" className="text-gold underline-offset-4 hover:underline">
                      polityką prywatności
                    </Link>{" "}
                    i akceptuję przetwarzanie moich danych w celu udzielenia odpowiedzi.
                  </span>
                </label>
                {errors.privacy && <p className="mt-2 text-[0.8rem] text-destructive">{errors.privacy}</p>}
              </div>

              {status === "error" && (
                <p role="alert" className="border border-destructive/60 px-4 py-3 text-[0.85rem] text-destructive">
                  {t.errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex w-fit items-center gap-6 bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright disabled:opacity-60"
              >
                {status === "sending" ? "Wysyłanie…" : "Wyślij wiadomość"}
                {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" strokeWidth={2} />}
              </button>
            </form>
          )}
        </section>

        {hasData && (
          <aside className="h-fit border-l-2 border-gold pl-6">
            <h2 className="eyebrow text-gold">{t.contactDataTitle}</h2>
            <ul className="mt-6 flex flex-col gap-4">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-3 text-foreground hover:text-gold">
                    <Mail className="h-4 w-4 text-gold" strokeWidth={1.5} /> {email}
                  </a>
                </li>
              )}
              {support && support !== email && (
                <li>
                  <span className="block text-xs text-muted-foreground">Obsługa użytkowników</span>
                  <a href={`mailto:${support}`} className="inline-flex items-center gap-3 text-foreground hover:text-gold">
                    <Mail className="h-4 w-4 text-gold" strokeWidth={1.5} /> {support}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 text-foreground hover:text-gold">
                    <Phone className="h-4 w-4 text-gold" strokeWidth={1.5} /> {phone}
                  </a>
                </li>
              )}
            </ul>
            {social.length > 0 && (
              <div className="mt-6 flex gap-3">
                {social.map((x) => (
                  <a key={x.platform} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={x.label} className="flex h-10 w-10 items-center justify-center border border-border hover:border-gold hover:text-gold">
                    <SocialIcon platform={x.platform} className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </PageShell>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.72rem] uppercase tracking-[0.14em] text-foreground/80">{label}</span>
      {children}
      {error && <span className="mt-2 block text-[0.8rem] text-destructive">{error}</span>}
    </label>
  );
}
