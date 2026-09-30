import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { errMsg, isSessionError } from "@/components/admin/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel administratora — Tata Na Baczności" },
      { name: "description", content: "Panel administratora Tata Na Baczności." },
      { property: "og:title", content: "Panel administratora — Tata Na Baczności" },
      { property: "og:description", content: "Panel administratora." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; exact?: boolean };
const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Pulpit", items: [{ to: "/admin", label: "Przegląd platformy", exact: true }] },
  { title: "Zarządzanie", items: [
    { to: "/admin/uzytkownicy", label: "Użytkownicy" },
    { to: "/admin/spolecznosc", label: "Społeczność i moderacja" },
    { to: "/admin/spotkania", label: "Spotkania" },
    { to: "/admin/rozmowy", label: "Rozmowy 1:1" },
    { to: "/admin/biblioteka", label: "Biblioteka i materiały premium" },
    { to: "/admin/podcast", label: "Podcast" },
    { to: "/admin/zamowienia", label: "Zamówienia i sprzedaż" },
  ] },
  { title: "Treści i wygląd", items: [
    { to: "/admin/strony", label: "Strony i edytor treści" },
    // "Treści strony" (/admin/tresci) hidden until the feature exists; route kept.
  ] },
  { title: "Komunikacja", items: [
    { to: "/admin/wiadomosci", label: "Wiadomości kontaktowe" },
    { to: "/admin/subskrybenci", label: "Newsletter" },
    { to: "/admin/ustawienia-email", label: "Powiadomienia" },
    { to: "/admin/powiadomienia", label: "Historia wysyłek" },
  ] },
  { title: "System", items: [
    { to: "/admin/ustawienia", label: "Ustawienia platformy" },
    { to: "/admin/bezpieczenstwo", label: "Bezpieczeństwo" },
    { to: "/admin/dziennik", label: "Dziennik zdarzeń" },
  ] },
];

function AdminLayout() {
  const fn = useServerFn(getAdminStatus);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-status"], queryFn: () => fn() });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const expired = !!error && isSessionError(error);
  useEffect(() => { if (expired) { qc.clear(); navigate({ to: "/auth", replace: true }); } }, [expired, navigate, qc]);

  if (isLoading || expired) return <div className="p-10 text-muted-foreground">Sprawdzanie uprawnień…</div>;
  if (error || !data?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Brak dostępu</h1>
          <p className="text-sm text-muted-foreground">{error ? errMsg(error) : "To konto nie ma uprawnień administratora."}</p>
          <Button onClick={signOut}>Wyloguj</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="border-b border-border/60 p-5 lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <Link to="/" className="font-display text-xl font-semibold uppercase">Tata Na Baczności</Link>
        <p className="eyebrow mt-1 text-gold">Panel administratora</p>
        <AdminNav />
        <div className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <p className="truncate">{data.email}</p>
          <Button variant="outline" size="sm" onClick={signOut}>Wyloguj</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-10"><Outlet /></main>
    </div>
  );
}

function AdminNav() {
  const path = useRouterState({ select: (r) => r.location.pathname.replace(/\/$/, "") || "/" });
  const isActive = (i: NavItem) => (i.exact ? path === i.to : path === i.to || path.startsWith(i.to + "/"));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(GROUPS.map((g) => [g.title, true])));
  return (
    <nav className="mt-6 space-y-3" aria-label="Menu panelu">
      {GROUPS.map((g) => {
        const on = open[g.title] || g.items.some(isActive);
        return (
          <div key={g.title}>
            <button type="button" aria-expanded={on} onClick={() => setOpen((o) => ({ ...o, [g.title]: !on }))}
              className="flex w-full items-center justify-between px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              {g.title}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${on ? "" : "-rotate-90"}`} aria-hidden />
            </button>
            {on && (
              <div className="mt-1 flex flex-wrap gap-1 lg:flex-col">
                {g.items.map((n) => (
                  <Link key={n.to} to={n.to} activeOptions={{ exact: true }} aria-current={isActive(n) ? "page" : undefined}
                    className={isActive(n)
                      ? "rounded border-l-2 border-gold bg-foreground/10 px-3 py-2 text-sm text-gold"
                      : "rounded border-l-2 border-transparent px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/5"}>
                    {n.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
