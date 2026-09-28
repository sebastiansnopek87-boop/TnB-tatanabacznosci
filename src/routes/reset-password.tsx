import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Ustaw nowe hasło — Tata Na Baczności" },
      { name: "description", content: "Ustawienie nowego hasła do panelu administratora." },
      { property: "og:title", content: "Ustaw nowe hasło — Tata Na Baczności" },
      { property: "og:description", content: "Ustawienie nowego hasła." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setErr("Hasło musi mieć co najmniej 10 znaków.");
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr("Nie udało się ustawić hasła. Link mógł wygasnąć — poproś o nowy.");
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 border border-border/60 p-8">
        <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Nowe hasło</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Hasło (min. 10 znaków)</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>Zapisz hasło</Button>
      </form>
    </div>
  );
}
