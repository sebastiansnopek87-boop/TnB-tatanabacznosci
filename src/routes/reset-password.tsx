import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthNotice, AuthShell, readAuthUrlParams } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Ustaw nowe hasło — Tata Na Baczności" },
      { name: "description", content: "Ustawienie nowego hasła do konta Tata Na Baczności." },
      { property: "og:title", content: "Ustaw nowe hasło — Tata Na Baczności" },
      { property: "og:description", content: "Ustawienie nowego hasła." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPage,
});

type State = "checking" | "ready" | "invalid" | "done";

function ResetPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("checking");
  const [expired, setExpired] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { errorCode } = readAuthUrlParams();
    if (errorCode) { setExpired(errorCode === "otp_expired"); setState("invalid"); return; }
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) { settled = true; setState("ready"); }
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) { settled = true; setState("ready"); } });
    const t = setTimeout(() => { if (!settled) setState("invalid"); }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Hasło musi mieć co najmniej 8 znaków.");
    if (pw !== pw2) return setErr("Hasła nie są identyczne.");
    if (busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      if (error.code === "same_password") return setErr("Nowe hasło musi różnić się od poprzedniego.");
      if (error.code === "weak_password") return setErr("Hasło jest zbyt słabe. Wybierz dłuższe lub mniej przewidywalne.");
      return setErr("Nie udało się ustawić hasła. Link mógł wygasnąć — poproś o nowy.");
    }
    window.history.replaceState(null, "", window.location.pathname);
    setState("done");
    toast.success("Hasło zostało zmienione.");
  }

  if (state === "checking") {
    return <AuthShell step="Odzyskiwanie hasła · krok 3 z 3" title="Weryfikacja linku" lead="Sprawdzamy link z wiadomości e-mail…"><div className="h-1 w-full animate-pulse bg-primary/30" /></AuthShell>;
  }

  if (state === "invalid") {
    return (
      <AuthShell step="Odzyskiwanie hasła" title="Link nieaktywny"
        lead={expired ? "Ten link wygasł lub został już wykorzystany." : "Ten link jest nieprawidłowy albo nie zawiera danych potrzebnych do ustawienia hasła."}>
        <AuthNotice tone="error">Poproś o nowy link do ustawienia hasła na stronie logowania.</AuthNotice>
        <Button asChild className="mt-6 h-11 w-full uppercase tracking-[0.15em]"><Link to="/auth">Przejdź do logowania</Link></Button>
      </AuthShell>
    );
  }

  if (state === "done") {
    return (
      <AuthShell step="Gotowe" title="Hasło zmienione" lead="Nowe hasło zostało zapisane. Jesteś zalogowany.">
        <AuthNotice tone="ok">Od teraz loguj się adresem e-mail i nowym hasłem.</AuthNotice>
        <Button className="mt-6 h-11 w-full uppercase tracking-[0.15em]" onClick={() => navigate({ to: "/moje-tnb", replace: true })}>Przejdź do Moje TNB</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell step="Odzyskiwanie hasła · krok 3 z 3" title="Ustaw nowe hasło" lead="Wybierz hasło o długości co najmniej 8 znaków.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pw">Nowe hasło</Label>
          <Input id="pw" type="password" autoComplete="new-password" className="h-11 bg-background/60" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Powtórz hasło</Label>
          <Input id="pw2" type="password" autoComplete="new-password" className="h-11 bg-background/60" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {err && <AuthNotice tone="error">{err}</AuthNotice>}
        <Button type="submit" className="h-11 w-full uppercase tracking-[0.15em]" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz hasło"}</Button>
      </form>
    </AuthShell>
  );
}
