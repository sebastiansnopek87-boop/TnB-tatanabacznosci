import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, LayoutDashboard, Users, FileText, Mail, Settings, Menu, X, LogOut } from "lucide-react";
import { errMsg, isSessionError } from "@/components/admin/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel administratora — Tata Na Baczności" },
      { name: "description", content: "Panel administratora Tata Na Baczności." },
      { property: "og:title", content: "Panel administratora — Tata Na Baczności" },
      { property: "og:description", content: "Panel administratora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; exact?: boolean };
const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Pulpit", items: [{ to: "/admin", label: "Przegląd platformy", exact: true }, { to: "/admin/centrum-kontroli", label: "Centrum kontroli" }] },
  { title: "Zarządzanie użytkownikami i społecznością", items: [
    { to: "/admin/uzytkownicy", label: "Użytkownicy" },
    { to: "/admin/spolecznosc", label: "Społeczność i moderacja" },
    { to: "/admin/spotkania", label: "Spotkania" },
    { to: "/admin/rozmowy", label: "Rozmowy 1:1" },
    { to: "/admin/zgloszenia-glos", label: "Zgłoszenia Głosu TNB" },
  ] },
  { title: "Treści i wygląd", items: [
    { to: "/admin/artykuly", label: "Artykuły" },
    { to: "/admin/strony", label: "Strony i edytor treści" },
    { to: "/admin/multimedia", label: "Multimedia" },
    { to: "/admin/standardy", label: "Standardy redakcyjne" },
    { to: "/admin/biblioteka", label: "Biblioteka i materiały premium" },
    { to: "/admin/podcast", label: "Głos TNB (podcast, wideo)" },
    { to: "/admin/asystent-ai", label: "Asystent redakcyjny AI" },
    // "Treści strony" (/admin/tresci) hidden until the feature exists; route kept.
  ] },
  { title: "Komunikacja i sprzedaż", items: [
    { to: "/admin/wiadomosci", label: "Wiadomości kontaktowe" },
    { to: "/admin/subskrybenci", label: "Newsletter" },
    { to: "/admin/ustawienia-email", label: "Powiadomienia" },
    { to: "/admin/szablony", label: "Szablony wiadomości" },
    { to: "/admin/zdarzenia", label: "Zdarzenia i reguły" },
    { to: "/admin/powiadomienia", label: "Historia wysyłek" },
    { to: "/admin/zamowienia", label: "Sprzedaż i zamówienia" },
  ] },
  { title: "System i konfiguracja", items: [
    { to: "/admin/ustawienia", label: "Ustawienia platformy" },
    { to: "/admin/bezpieczenstwo", label: "Bezpieczeństwo" },
    { to: "/admin/dziennik", label: "Dziennik zdarzeń" },
    { to: "/admin/platnosci", label: "Operatorzy płatności" },
  ] },
];

function AdminLayout() {
  const fn = useServerFn(getAdminStatus);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-status"], queryFn: () => fn() });

  const [menu, setMenu] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useEffect(() => { setMenu(false); }, [pathname]);
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
    <div className="admin-panel min-h-screen bg-background text-foreground lg:flex">
      <aside className="border-b border-border bg-admin-sidebar p-5 lg:min-h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-6">
        <Link to="/" className="block font-display text-2xl font-semibold uppercase leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Tata Na Baczności</Link>
        <p className="mt-2 text-xs font-medium text-admin-copper">Panel administratora</p>
        <Button variant="outline" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="admin-navigation" className="mt-5 h-11 w-full justify-between lg:hidden">{menu ? "Ukryj menu panelu" : "Pokaż menu panelu"}{menu ? <X aria-hidden /> : <Menu aria-hidden />}</Button>
        <div id="admin-navigation" className={menu ? "" : "hidden lg:block"}><AdminNav /></div>
        <div className="mt-6 space-y-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <p className="truncate">{data.email}</p>
          <Button variant="outline" size="sm" className="min-h-10" onClick={signOut}><LogOut aria-hidden />Wyloguj</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-8 xl:p-10"><Outlet /></main>
    </div>
  );
}

function AdminNav() {
  const path = useRouterState({ select: (r) => r.location.pathname.replace(/\/$/, "") || "/" });
  const isActive = (i: NavItem) => (i.exact ? path === i.to : path === i.to || path.startsWith(i.to + "/"));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(GROUPS.map((g) => [g.title, true])));
  useEffect(() => {
    const group = GROUPS.find((g) => g.items.some((i) => i.exact ? path === i.to : path === i.to || path.startsWith(i.to + "/")));
    if (group) setOpen((o) => ({ ...o, [group.title]: true }));
  }, [path]);
  const icons = [LayoutDashboard, Users, FileText, Mail, Settings];
  return (
    <nav className="mt-7 divide-y divide-border" aria-label="Menu panelu">
      {GROUPS.map((g, index) => {
        const on = open[g.title] ?? true;
        const Icon = icons[index] ?? Settings;
        return (
          <div key={g.title} className="py-4 first:pt-0">
            <Button variant="ghost" aria-expanded={on} aria-controls={`admin-group-${index}`} onClick={() => setOpen((o) => ({ ...o, [g.title]: !on }))}
              className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left text-sm font-semibold leading-snug text-foreground hover:bg-admin-hover hover:text-foreground">
              <Icon className="text-admin-copper" aria-hidden /><span className="min-w-0 flex-1">{g.title}</span><ChevronDown className={`transition-transform motion-reduce:transition-none ${on ? "" : "-rotate-90"}`} aria-hidden />
            </Button>
            {on && <div id={`admin-group-${index}`} className="mt-2 flex flex-col gap-1">
              {g.items.map((n) => <Link key={n.to} to={n.to} activeOptions={{ exact: true }} aria-current={isActive(n) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded border-l-[3px] py-2 pl-8 pr-2 text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive(n) ? "border-gold bg-admin-hover font-semibold text-gold" : "border-transparent text-admin-label hover:bg-admin-hover hover:text-foreground"}`}>
                <span className="min-w-0 flex-1">{n.label}</span>{isActive(n) && <ChevronRight className="size-4 shrink-0" aria-hidden />}
              </Link>)}
            </div>}
          </div>
        );
      })}
    </nav>
  );
}
