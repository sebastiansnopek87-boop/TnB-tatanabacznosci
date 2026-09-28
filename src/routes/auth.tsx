import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthNotice, AuthShell, readAuthUrlParams } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logowanie — Tata Na Baczności" },
      { name: "description", content: "Logowanie do panelu Tata Na Baczności." },
      { property: "og:title", content: "Logowanie — Tata Na Baczności" },
      { property: "og:description", content: "Logowanie do panelu Tata Na Baczności." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "register" | "reset" | "reset-sent";
type Msg = { tone: "ok" | "error" | "info"; text: string } | null;

const emailSchema = z.string().trim().email();

function loginError(code?: string): string {
  switch (code) {
    case "email_not_confirmed": return "Konto nie jest jeszcze aktywne — adres e-mail nie został potwierdzony.";
    case "user_banned": return "To konto jest nieaktywne. Skontaktuj się z administratorem.";
    case "over_request_rate_limit": return "Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.";
    default: return "Nieprawidłowy e-mail lub hasło.";
  }
}

function linkError(code: string): string {
  if (code === "otp_expired") return "Link wygasł lub został już użyty. Poproś o nowy link poniżej.";
  return "Link jest nieprawidłowy. Poproś o nowy link poniżej.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});

  // Handle landing from e-mail links (confirmation, expired links).
  useEffect(() => {
    const { type, errorCode } = readAuthUrlParams();
    if (errorCode) { setMode("reset"); setMsg({ tone: "error", text: linkError(errorCode) }); }
    else if (type === "signup" || type === "email_change") setMsg({ tone: "ok", text: "Adres e-mail został potwierdzony. Możesz się zalogować." });
    if (errorCode || type) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function go(m: Mode) { setMode(m); setMsg(null); setFieldErr({}); }

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
    navigate({ to: "/admin", replace: true });
  }

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

  if (mode === "register") {
    return (
      <AuthShell step="Rejestracja" title="Załóż konto"
        lead="Rejestracja kont jest obecnie zamknięta. Konta administratorów tworzone są ręcznie przez zespół Tata Na Baczności.">
        <AuthNotice tone="info">Jeśli potrzebujesz dostępu, skontaktuj się z nami przez stronę Kontakt.</AuthNotice>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {helper("Masz konto? Zaloguj się", "login")}
          <Button variant="outline" onClick={() => navigate({ to: "/kontakt" })}>Kontakt</Button>
        </div>
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
    <AuthShell step="Panel administratora" title="Zaloguj się" lead="Zaloguj się, aby przejść do panelu zarządzania stroną."
      footer={<>Nie masz konta? {helper("Rejestracja", "register")}</>}>
      <form onSubmit={onLogin} noValidate className="space-y-5">
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
        <Button type="submit" className="h-11 w-full uppercase tracking-[0.15em]" disabled={busy}>
          {busy ? "Logowanie…" : "Zaloguj"}
        </Button>
      </form>
    </AuthShell>
  );
}
