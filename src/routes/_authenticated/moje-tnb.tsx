import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "@/lib/admin.functions";
import { listMyPurchases } from "@/lib/orders.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeading } from "@/components/tnb/PageShell";
import { AuthNotice } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MyMeetings } from "@/components/consult/MyMeetings";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/moje-tnb")({
  head: () => ({
    meta: [
      { title: "Moje TNB — Tata Na Baczności" },
      { name: "description", content: "Twój profil, materiały i ustawienia konta w Tata Na Baczności." },
      { property: "og:title", content: "Moje TNB — Tata Na Baczności" },
      { property: "og:description", content: "Twój profil, materiały i ustawienia konta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MojeTnb,
});

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

function MojeTnb() {
  // Same session source as the header; USER_UPDATED refreshes it after profile edits.
  const auth = useAuth();
  const user = auth.user;
  const loadError = auth.status === "signed-out";
  const setUser = (_u: User) => {};
  const navigate = useNavigate();
  const qc = useQueryClient();
  const adminFn = useServerFn(getAdminStatus);
  const { data: admin } = useQuery({ queryKey: ["admin-status", user?.id], queryFn: () => adminFn(), enabled: !!user });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    // Leave the protected area first, otherwise the auth gate redirects to /auth on SIGNED_OUT.
    await navigate({ to: "/", replace: true });
    await supabase.auth.signOut();
  }

  return (
    <PageShell>
      <PageHeading eyebrow="Strefa użytkownika" title="Moje TNB" intro="Twój profil, materiały i ustawienia konta." />
      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-6 px-5 py-12 lg:grid-cols-2 lg:px-14 lg:py-16">
        {loadError && <div className="lg:col-span-2"><AuthNotice tone="error">Nie udało się wczytać profilu. Odśwież stronę.</AuthNotice></div>}
        {!user && !loadError && <div className="h-40 animate-pulse bg-card/60 lg:col-span-2" />}
        {user && (
          <>
            <div className="lg:col-span-2"><Card title="Moje spotkania"><MyMeetings /></Card></div>
            <ProfileCard user={user} onSaved={setUser} />
            <div className="space-y-6">
              <PasswordCard email={user.email ?? ""} />
              <Card title="Moje materiały"><MyPurchases /></Card>
              {admin?.isAdmin && (
                <Card title="Administracja">
                  <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 text-center uppercase tracking-[0.15em]"><Link to="/admin">Przejdź do panelu administratora</Link></Button>
                </Card>
              )}
              <Card title="Sesja">
                <Button variant="outline" onClick={signOut} className="h-11 w-full uppercase tracking-[0.15em]">
                  <LogOut className="mr-2 h-4 w-4" /> Wyloguj się
                </Button>
              </Card>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function MyPurchases() {
  const fn = useServerFn(listMyPurchases);
  const q = useQuery({ queryKey: ["my-purchases"], queryFn: () => fn() });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <p className="text-sm text-destructive">Nie udało się wczytać materiałów.</p>;
  if (!q.data?.length) return <p className="text-sm leading-relaxed text-muted-foreground">Nie masz jeszcze zakupionych materiałów. Znajdziesz je w <Link to="/biblioteka" className="text-gold underline">Bibliotece</Link>.</p>;
  return (
    <ul className="space-y-3">
      {q.data.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0">
          <span className="min-w-0 break-words text-sm text-foreground">{p.title}</span>
          <Link to="/biblioteka/$slug" params={{ slug: p.slug }} className="text-[0.7rem] uppercase tracking-[0.14em] text-gold">Otwórz</Link>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative border border-border/70 bg-card/80 p-6 sm:p-8">
      <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function ProfileCard({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
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
    <Card title="Profil">
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
    </Card>
  );
}

function PasswordCard({ email }: { email: string }) {
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
    <Card title="Zmiana hasła">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field id="cur" label="Obecne hasło"><Input id="cur" type="password" autoComplete="current-password" className={cls} value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field id="npw" label="Nowe hasło"><Input id="npw" type="password" autoComplete="new-password" className={cls} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field id="npw2" label="Powtórz nowe hasło"><Input id="npw2" type="password" autoComplete="new-password" className={cls} value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {msg && <AuthNotice tone={msg.tone}>{msg.text}</AuthNotice>}
        <Button type="submit" disabled={busy} className="h-11 w-full uppercase tracking-[0.15em]">{busy ? "Zmienianie…" : "Zmień hasło"}</Button>
      </form>
    </Card>
  );
}
