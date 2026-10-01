import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARTICLE_COMMENT_MAX } from "@/lib/article-interactions";
import { GUEST_COMMENT_RULES, submitGuestComment } from "@/lib/guest-comments.functions";
import type { Article } from "@/lib/articles";

// Comment form for visitors without an account. Nothing is published until the e-mail link is confirmed.
export function GuestCommentForm({ a }: { a: Article }) {
  const submit = useServerFn(submitGuestComment);
  const started = useRef(Date.now());
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", body: "", rules: false, website: "" });
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((o) => ({ ...o, [k]: k === "rules" ? (e.target as HTMLInputElement).checked : k === "body" ? e.target.value.slice(0, ARTICLE_COMMENT_MAX) : e.target.value }));

  async function send(e: React.FormEvent) {
    e.preventDefault(); if (sending) return; setErr(null);
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || f.body.trim().length < 2) { setErr("Uzupełnij imię, nazwisko, adres e-mail i treść komentarza."); return; }
    if (!f.rules) { setErr("Zaakceptuj zasady komentowania."); return; }
    setSending(true);
    try {
      await submit({ data: { articleId: a.id, ...f, rules: true, elapsedMs: Date.now() - started.current } });
      setDone(true);
    } catch (x: any) {
      let m = String(x?.message ?? "");
      try { const p = JSON.parse(m); if (Array.isArray(p)) m = p[0]?.message ?? m; } catch { /* plain message */ }
      setErr(m && m.length < 200 ? m : "Nie udało się wysłać komentarza. Spróbuj ponownie.");
    } finally { setSending(false); }
  }

  if (done) return (
    <div className="mt-5 flex gap-3 border border-gold/50 bg-card/40 p-5" role="status">
      <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
      <div className="text-sm text-foreground/85">
        <p className="font-medium text-foreground">Sprawdź swoją skrzynkę e-mail.</p>
        <p className="mt-1">Jeśli dane są poprawne, wysłaliśmy wiadomość z linkiem potwierdzającym. Komentarz pojawi się dopiero po kliknięciu w link. Link jest jednorazowy i ważny 48 godzin.</p>
      </div>
    </div>
  );

  return (
    <form onSubmit={send} className="mt-5 space-y-3 border border-border/60 p-4 sm:p-5" noValidate>
      <p className="text-sm text-foreground/85">
        Możesz skomentować bez konta. Masz konto TNB? <Link to="/auth" search={{ powrot: `/artykuly/${a.slug}` }} className="text-gold underline underline-offset-4">Zaloguj się</Link>.
      </p>
      <p className="border-l-2 border-gold pl-3 text-xs leading-relaxed text-muted-foreground">
        Twój komentarz nie pojawi się od razu na stronie. Najpierw wyślemy Ci wiadomość z linkiem potwierdzającym. Po kliknięciu w link komentarz zostanie opublikowany, o ile nie narusza zasad społeczności.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={f.firstName} onChange={set("firstName")} placeholder="Imię" aria-label="Imię" maxLength={60} autoComplete="given-name" required />
        <Input value={f.lastName} onChange={set("lastName")} placeholder="Nazwisko" aria-label="Nazwisko" maxLength={80} autoComplete="family-name" required />
      </div>
      <Input type="email" value={f.email} onChange={set("email")} placeholder="Adres e-mail (nie będzie widoczny publicznie)" aria-label="Adres e-mail" maxLength={254} autoComplete="email" required />
      <Textarea value={f.body} onChange={set("body")} rows={4} placeholder="Podziel się swoim doświadczeniem…" aria-label="Treść komentarza" required />
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={f.rules} onChange={set("rules")} className="mt-0.5" />
        <span>{GUEST_COMMENT_RULES} Dane przetwarzamy zgodnie z <Link to="/polityka-prywatnosci" className="text-gold underline">polityką prywatności</Link>.</span>
      </label>
      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{f.body.length}/{ARTICLE_COMMENT_MAX}</span>
        <Button type="submit" disabled={sending}>{sending ? "Wysyłanie…" : "Wyślij komentarz"}</Button>
      </div>
    </form>
  );
}
