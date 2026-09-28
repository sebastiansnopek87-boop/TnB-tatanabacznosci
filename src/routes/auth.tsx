import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logowanie administratora — Tata Na Baczności" },
      { name: "description", content: "Logowanie do panelu administratora Tata Na Baczności." },
      { property: "og:title", content: "Logowanie administratora — Tata Na Baczności" },
      { property: "og:description", content: "Logowanie do panelu administratora." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: "Nieprawidłowy e-mail lub hasło." });
      navigate({ to: "/admin", replace: true });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      setMsg(error ? { ok: false, text: "Nie udało się wysłać wiadomości. Spróbuj ponownie później." } : { ok: true, text: "Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła." });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 border border-border/60 p-8">
        <div>
          <p className="eyebrow text-gold">Panel administratora</p>
          <h1 className="mt-3 font-display text-3xl font-semibold uppercase text-foreground">
            {mode === "login" ? "Zaloguj się" : "Reset hasła"}
          </h1>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "login" && (
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {msg && <p role="status" className={msg.ok ? "text-sm text-gold" : "text-sm text-destructive"}>{msg.text}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Proszę czekać…" : mode === "login" ? "Zaloguj" : "Wyślij link"}
        </Button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { setMode(mode === "login" ? "reset" : "login"); setMsg(null); }}>
          {mode === "login" ? "Nie pamiętasz hasła?" : "Wróć do logowania"}
        </button>
        <p className="text-xs text-muted-foreground">Konta administratorów są tworzone ręcznie — nie ma publicznej rejestracji.</p>
      </form>
    </div>
  );
}
