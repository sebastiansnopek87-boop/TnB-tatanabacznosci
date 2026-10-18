import { useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthNotice } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Profile data lives in the user's own auth metadata — no extra table; only the signed-in user can read/write it.
type Profile = { nick: string; first_name: string; last_name: string; phone_prefix: string; phone: string };

const profileSchema = z.object({
  nick: z.string().trim().max(40, "Nick może mieć maksymalnie 40 znaków."),
  first_name: z.string().trim().max(60, "Imię może mieć maksymalnie 60 znaków."),
  last_name: z.string().trim().max(80, "Nazwisko może mieć maksymalnie 80 znaków."),
  phone_prefix: z.string().trim().regex(/^(\+\d{1,4})?$/, "Prefiks w formacie +48."),
  phone: z.string().trim().regex(/^[\d\s-]{0,20}$/, "Numer telefonu może zawierać tylko cyfry, spacje i myślniki."),
}).refine((p) => !p.phone || p.phone_prefix, { message: "Podaj prefiks kraju, np. +48.", path: ["phone_prefix"] });

function readProfile(u: User): Profile {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const s = (k: string, d = "") => (typeof m[k] === "string" ? (m[k] as string) : d);
  return { nick: s("nick"), first_name: s("first_name"), last_name: s("last_name"), phone_prefix: s("phone_prefix", "+48"), phone: s("phone") };
}

export function AccountSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 border-t border-border/70 py-6">
      <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

export function ProfileCard({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [p, setP] = useState<Profile>(() => readProfile(user));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setP((v) => ({ ...v, [k]: e.target.value }));
  const qc = useQueryClient();
  const ident = useQuery({
    queryKey: ["my-identity", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_my_identity");
      if (error) throw error;
      return (data as Array<{ tnb_id: string; display_mode: "nick" | "full_name"; display_name: string | null }>)[0] ?? null;
    },
  });
  const [modeMsg, setModeMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  async function chooseMode(mode: "nick" | "full_name") {
    setModeMsg(null);
    const { data, error } = await supabase.rpc("set_my_display_mode", { _mode: mode });
    qc.invalidateQueries({ queryKey: ["my-identity"] });
    if (error) {
      return setModeMsg({ tone: "error", text: error.message?.includes("display_name_missing")
        ? (mode === "nick" ? "Uzupełnij poniżej nick i zapisz zmiany — bez niego nie można publikować w społeczności." : "Uzupełnij poniżej imię i nazwisko i zapisz zmiany — bez nich nie można publikować w społeczności.")
        : "Nie udało się zapisać ustawienia." });
    }
    setModeMsg({ tone: "ok", text: `Będziesz widoczny jako „${data}”.` });
  }
  const registered = new Date(user.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = profileSchema.safeParse(p);
    if (!parsed.success) return setMsg({ tone: "error", text: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." });
    setBusy(true);
    const { data, error } = await supabase.auth.updateUser({ data: parsed.data });
    setBusy(false);
    if (error || !data.user) return setMsg({ tone: "error", text: "Nie udało się zapisać zmian. Spróbuj ponownie." });
    onSaved(data.user);
    setP(readProfile(data.user));
    // Keep community signatures in sync with the edited nick / name.
    const mode = ident.data?.display_mode ?? "nick";
    const { error: sErr } = await supabase.rpc("set_my_display_mode", { _mode: mode });
    qc.invalidateQueries({ queryKey: ["my-identity"] });
    if (sErr?.message?.includes("display_name_missing"))
      return setMsg({ tone: "error", text: mode === "nick" ? "Zapisano, ale brakuje nicku — uzupełnij go albo wybierz podpis imieniem i nazwiskiem." : "Zapisano, ale brakuje imienia lub nazwiska — uzupełnij je albo wybierz podpis nickiem." });
    setMsg({ tone: "ok", text: "Zmiany zostały zapisane." });
  }

  const cls = "h-11 bg-background/60";
  return (
    <AccountSection title="Profil">
      <dl className="mb-6 grid gap-3 [&_dd]:break-all text-sm sm:grid-cols-2">
        <div><dt className="eyebrow text-gold/80">Adres e-mail</dt><dd className="mt-1 break-all text-foreground">{user.email}</dd></div>
        <div><dt className="eyebrow text-gold/80">Data rejestracji</dt><dd className="mt-1 text-foreground">{registered}</dd></div>
        <div className="sm:col-span-2"><dt className="eyebrow text-gold/80">TNB ID</dt><dd className="mt-1 font-mono tracking-wider text-foreground">{ident.data?.tnb_id ?? "…"}</dd><p className="mt-1 text-xs text-muted-foreground">Stały identyfikator Twojego konta. Nie jest hasłem — możesz go podać w kontakcie z obsługą.</p></div>
      </dl>
      <fieldset className="mb-6 space-y-3 rounded-sm border border-border/60 p-4">
        <legend className="px-1 text-sm font-medium text-foreground">Jak chcesz być widoczny w społeczności?</legend>
        <div className="flex flex-wrap gap-2">
          {([["nick", "Mój nick"], ["full_name", "Moje imię i nazwisko"]] as const).map(([v, l]) => (
            <Button key={v} type="button" variant={ident.data?.display_mode === v ? "default" : "outline"} aria-pressed={ident.data?.display_mode === v} disabled={!ident.data} onClick={() => chooseMode(v)}>{l}</Button>
          ))}
        </div>
        {ident.data && !modeMsg && (ident.data.display_name
          ? <p className="text-xs text-muted-foreground">Inni widzą Cię jako „{ident.data.display_name}”.</p>
          : <AuthNotice tone="error">{ident.data.display_mode === "nick" ? "Nie masz jeszcze nicku — uzupełnij go poniżej, aby publikować w społeczności." : "Brakuje imienia lub nazwiska — uzupełnij je poniżej, aby publikować w społeczności."}</AuthNotice>)}
        {modeMsg && <AuthNotice tone={modeMsg.tone}>{modeMsg.text}</AuthNotice>}
      </fieldset>
      <form onSubmit={save} noValidate className="space-y-4">
        <Field id="nick" label="Nick"><Input id="nick" className={cls} value={p.nick} onChange={set("nick")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fn" label="Imię"><Input id="fn" autoComplete="given-name" className={cls} value={p.first_name} onChange={set("first_name")} /></Field>
          <Field id="ln" label="Nazwisko"><Input id="ln" autoComplete="family-name" className={cls} value={p.last_name} onChange={set("last_name")} /></Field>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field id="pp" label="Prefiks"><Input id="pp" className={cls} value={p.phone_prefix} onChange={set("phone_prefix")} /></Field>
          <Field id="ph" label="Numer telefonu"><Input id="ph" type="tel" autoComplete="tel-national" className={cls} value={p.phone} onChange={set("phone")} /></Field>
        </div>
        {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
        <Button type="submit" disabled={busy} className="h-11 w-full uppercase tracking-[0.15em]">{busy ? "Zapisywanie…" : "Zapisz zmiany"}</Button>
      </form>
    </AccountSection>
  );
}

export function PasswordCard({ email }: { email: string }) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!cur) return setMsg({ tone: "error", text: "Podaj obecne hasło." });
    if (pw.length < 8) return setMsg({ tone: "error", text: "Nowe hasło musi mieć co najmniej 8 znaków." });
    if (pw !== pw2) return setMsg({ tone: "error", text: "Hasła nie są identyczne." });
    setBusy(true);
    // Verify the current password with the existing sign-in mechanism before changing it.
    const check = await supabase.auth.signInWithPassword({ email, password: cur });
    if (check.error) { setBusy(false); return setMsg({ tone: "error", text: "Obecne hasło jest nieprawidłowe." }); }
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    setBusy(false);
    if (error) {
      const weak = /weak|pwned|leaked|known/i.test(error.message);
      return setMsg({ tone: "error", text: weak ? "To hasło jest zbyt słabe lub wyciekło w sieci. Wybierz inne." : "Nie udało się zmienić hasła. Spróbuj ponownie." });
    }
    setCur(""); setPw(""); setPw2("");
    setMsg({ tone: "ok", text: "Hasło zostało zmienione." });
  }

  const cls = "h-11 bg-background/60";
  return (
    <AccountSection title="Zmiana hasła">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field id="cur" label="Obecne hasło"><Input id="cur" type="password" autoComplete="current-password" className={cls} value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field id="npw" label="Nowe hasło"><Input id="npw" type="password" autoComplete="new-password" className={cls} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field id="npw2" label="Powtórz nowe hasło"><Input id="npw2" type="password" autoComplete="new-password" className={cls} value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
        <Button type="submit" disabled={busy} className="h-11 w-full uppercase tracking-[0.15em]">{busy ? "Zmienianie…" : "Zmień hasło"}</Button>
      </form>
    </AccountSection>
  );
}
