import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthNotice, AuthShell, readAuthUrlParams } from "@/components/auth/AuthShell";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logowanie — Tata Na Baczności" },
      { name: "description", content: "Logowanie i rejestracja w Tata Na Baczności." },
      { property: "og:title", content: "Logowanie — Tata Na Baczności" },
      { property: "og:description", content: "Logowanie i rejestracja w Tata Na Baczności." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tryb?: "rejestracja"; powrot?: string } => ({
    ...(s["tryb"] === "rejestracja" ? { tryb: "rejestracja" as const } : {}),
    ...(typeof s["powrot"] === "string" && safeReturn(s["powrot"]) ? { powrot: s["powrot"] } : {}),
  }),
  component: AuthPage,
});

// Only same-origin library paths are accepted as a return target (no open redirects).
function safeReturn(p: string) { return /^\/biblioteka\/[a-z0-9-]{1,120}$/.test(p); }
const RETURN_KEY = "tnb-return";

type Mode = "login" | "register" | "register-sent" | "reset" | "reset-sent";
type Msg = { tone: "ok" | "error" | "info"; text: string } | null;

const emailSchema = z.string().trim().email();

function loginError(code?: string): string {
  switch (code) {
    case "email_not_confirmed": return "Konto nie jest jeszcze aktywne — adres e-mail nie został potwierdzony. Kliknij link z wiadomości albo wyślij nowy.";
    case "user_banned": return "To konto jest nieaktywne. Skontaktuj się z administratorem.";
    case "over_request_rate_limit": return "Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.";
    default: return "Nieprawidłowy e-mail lub hasło.";
  }
}

function linkError(code: string): string {
  if (code === "otp_expired") return "Link wygasł lub został już użyty. Jeśli konto jest już aktywne, zaloguj się. W przeciwnym razie wyślij nowy link aktywacyjny.";
  return "Link jest nieprawidłowy. Zaloguj się lub wyślij nowy link aktywacyjny.";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.tryb === "rejestracja" ? "register" : "login");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  if (typeof window !== "undefined" && search.powrot) sessionStorage.setItem(RETURN_KEY, search.powrot);
  const goAfter = () => {
    const r = typeof window !== "undefined" ? sessionStorage.getItem(RETURN_KEY) : null;
    if (r) sessionStorage.removeItem(RETURN_KEY);
    if (r && safeReturn(r)) return navigate({ href: r, replace: true });
    return navigate({ to: "/moje-tnb", replace: true });
  };

  // Already signed in (also the return point after Google/Apple) → profile.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) goAfter(); });
  }, [navigate]);
  useEffect(() => { setMode(search.tryb === "rejestracja" ? "register" : "login"); setMsg(null); }, [search.tryb]);

  // Handle landing from e-mail links (confirmation, expired links).
  useEffect(() => {
    const { type, errorCode } = readAuthUrlParams();
    if (errorCode) { setMode("login"); setMsg({ tone: "error", text: linkError(errorCode) }); }
    else if (type === "signup" || type === "email_change") setMsg({ tone: "ok", text: "Adres e-mail został potwierdzony. Możesz się zalogować." });
    if (errorCode || type) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const [resent, setResent] = useState(false);
  async function resendActivation() {
    if (!emailSchema.safeParse(email).success) return setFieldErr({ email: "Podaj poprawny adres e-mail, aby wysłać nowy link." });
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth` } });
    setBusy(false);
    if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) return setMsg({ tone: "error", text: "Wysłano zbyt wiele wiadomości. Odczekaj kilka minut i spróbuj ponownie." });
    // Neutral message either way — does not reveal whether the address has an account.
    setResent(true);
    setMsg({ tone: "ok", text: "Jeśli konto dla tego adresu czeka na aktywację, wysłaliśmy nowy link. Sprawdź też folder Spam." });
  }

  function go(m: Mode) { setResent(false); setMode(m); setMsg(null); setFieldErr({}); }

  function validate(needPassword: boolean) {
    const e: typeof fieldErr = {};
    if (!emailSchema.safeParse(email).success) e.email = "Podaj poprawny adres e-mail.";
    if (needPassword && !password) e.password = "Podaj hasło.";
    setFieldErr(e);
    return Object.keys(e).length === 0;
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (!validate(true)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: loginError(error.code) });
    toast.success("Zalogowano pomyślnie.");
    goAfter();
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!validate(true)) return;
    if (password.length > 72) return setFieldErr({ password: "Hasło może mieć najwyżej 72 znaki." });
    if (password.length < 8) return setFieldErr({ password: "Hasło musi mieć co najmniej 8 znaków." });
    if (password !== password2) return setFieldErr({ password: "Hasła nie są identyczne." });
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
    setBusy(false);
    if (error) {
      const text = /weak|pwned|leaked/i.test(error.message) || error.code === "weak_password"
        ? "To hasło jest zbyt słabe lub wyciekło w sieci. Wybierz inne."
        : /not allowed|invalid/i.test(error.message) ? "Ten adres e-mail nie może zostać użyty. Podaj inny adres."
        : error.status === 429 ? "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie."
        : "Nie udało się założyć konta. Spróbuj ponownie.";
      return setMsg({ tone: "error", text });
    }
    if (data.session) return goAfter();
    setMode("register-sent");
  }

  async function oauth(provider: "google" | "apple") {
    if (busy) return;
    setMsg(null); setBusy(true);
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` }).catch((e) => ({ error: e, redirected: false }));
    setBusy(false);
    if (res.error) {
      const cancelled = /cancel|closed|denied/i.test(String((res.error as Error).message ?? res.error));
      return setMsg({ tone: cancelled ? "info" : "error", text: cancelled ? "Logowanie zostało anulowane." : "Nie udało się zalogować. Spróbuj ponownie." });
    }
    if (res.redirected) return;
    goAfter();
  }

  const social = (
    <div className="space-y-3">
      <button type="button" disabled={busy} onClick={() => oauth("google")} className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50">
        <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Kontynuuj z Google
      </button>
      <button type="button" disabled={busy} onClick={() => oauth("apple")} className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-foreground/20 bg-background text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50">
        <svg aria-hidden viewBox="0 0 384 512" className="h-5 w-5 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
        Kontynuuj z Apple
      </button>
      <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.15em] text-muted-foreground"><span className="h-px flex-1 bg-border" />lub<span className="h-px flex-1 bg-border" /></div>
    </div>
  );

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!validate(false)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) {
      const text = error.code === "over_email_send_rate_limit" || error.status === 429
        ? "Wysłano zbyt wiele wiadomości w krótkim czasie. Odczekaj kilka minut i spróbuj ponownie."
        : "Nie udało się wysłać wiadomości. Spróbuj ponownie później.";
      return setMsg({ tone: "error", text });
    }
    setMode("reset-sent");
  }

  const emailField = (
    <div className="space-y-2">
      <Label htmlFor="email">Adres e-mail</Label>
      <Input id="email" type="email" autoComplete="email" value={email} aria-invalid={!!fieldErr.email}
        className="h-11 bg-background/60" onChange={(e) => setEmail(e.target.value)} />
      {fieldErr.email && <p className="text-xs text-destructive">{fieldErr.email}</p>}
    </div>
  );

  const helper = (label: string, m: Mode) => (
    <button type="button" onClick={() => go(m)} className="text-sm text-gold underline-offset-4 hover:underline">{label}</button>
  );

  if (mode === "register-sent") {
    return (
      <AuthShell step="Rejestracja · krok 2 z 2" title="Potwierdź adres"
        lead={<>Jeśli adres <span className="text-foreground">{email.trim()}</span> nie ma jeszcze konta, wysłaliśmy na niego link aktywacyjny. Kliknij go, aby aktywować konto.</>}>
        <AuthNotice tone={msg?.tone ?? "ok"}>{msg?.text ?? "Sprawdź też folder Spam. Jeśli masz już konto, po prostu się zaloguj."}</AuthNotice>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          {!resent && <button type="button" disabled={busy} onClick={resendActivation} className="text-sm text-gold underline-offset-4 hover:underline disabled:opacity-50">{busy ? "Wysyłanie…" : "Wyślij link ponownie"}</button>}
          {helper("Wróć do logowania", "login")}
        </div>
      </AuthShell>
    );
  }

  if (mode === "register") {
    return (
      <AuthShell step="Rejestracja · krok 1 z 2" title="Załóż konto" lead="Dołącz do społeczności Tata Na Baczności."
        footer={<>Masz już konto? {helper("Zaloguj się", "login")}</>}>
        {social}
        <form onSubmit={onRegister} noValidate className="mt-4 space-y-5">
          {emailField}
          <div className="space-y-2">
            <Label htmlFor="password">Hasło (min. 8 znaków)</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} aria-invalid={!!fieldErr.password}
              className="h-11 bg-background/60" onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password2">Powtórz hasło</Label>
            <Input id="password2" type="password" autoComplete="new-password" value={password2}
              className="h-11 bg-background/60" onChange={(e) => setPassword2(e.target.value)} />
            {fieldErr.password && <p className="text-xs text-destructive">{fieldErr.password}</p>}
          </div>
          {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
          <Button type="submit" className="h-11 w-full uppercase tracking-[0.15em]" disabled={busy}>
            {busy ? "Zakładanie konta…" : "Załóż konto"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (mode === "reset-sent") {
    return (
      <AuthShell step="Odzyskiwanie hasła · krok 2 z 3" title="Sprawdź skrzynkę"
        lead={<>Jeśli konto dla adresu <span className="text-foreground">{email.trim()}</span> istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.</>}>
        <AuthNotice tone="ok">Link jest jednorazowy i ważny przez ograniczony czas. Sprawdź też folder Spam.</AuthNotice>
        <div className="mt-6">{helper("Wróć do logowania", "login")}</div>
      </AuthShell>
    );
  }

  if (mode === "reset") {
    return (
      <AuthShell step="Odzyskiwanie hasła · krok 1 z 3" title="Nie pamiętasz hasła?"
        lead="Podaj adres e-mail konta. Wyślemy link, dzięki któremu ustawisz nowe hasło.">
        <form onSubmit={onReset} noValidate className="space-y-5">
          {emailField}
          {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
          <Button type="submit" className="h-11 w-full uppercase tracking-[0.15em]" disabled={busy}>
            {busy ? "Wysyłanie…" : "Wyślij link"}
          </Button>
          {helper("Wróć do logowania", "login")}
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell step="Logowanie" title="Zaloguj się" lead="Zaloguj się do Moje TNB."
      footer={<>Nie masz konta? {helper("Rejestracja", "register")}</>}>
      {social}
      <form onSubmit={onLogin} noValidate className="mt-4 space-y-5">
        {emailField}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Hasło</Label>
            <button type="button" onClick={() => go("reset")} className="text-xs text-gold underline-offset-4 hover:underline">Nie pamiętasz hasła?</button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" value={password} aria-invalid={!!fieldErr.password}
            className="h-11 bg-background/60" onChange={(e) => setPassword(e.target.value)} />
          {fieldErr.password && <p className="text-xs text-destructive">{fieldErr.password}</p>}
        </div>
        {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
        {msg?.tone === "error" && /aktywn|potwierdz/i.test(msg.text) && !resent && (
          <button type="button" disabled={busy} onClick={resendActivation} className="text-sm text-gold underline-offset-4 hover:underline disabled:opacity-50">Wyślij nowy link aktywacyjny</button>
        )}
        <Button type="submit" className="h-11 w-full uppercase tracking-[0.15em]" disabled={busy}>
          {busy ? "Logowanie…" : "Zaloguj"}
        </Button>
      </form>
    </AuthShell>
  );
}
