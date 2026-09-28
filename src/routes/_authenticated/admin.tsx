import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

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

const NAV = [
  { to: "/admin", label: "Pulpit", exact: true },
  { to: "/admin/wiadomosci", label: "Wiadomości" },
  { to: "/admin/subskrybenci", label: "Subskrybenci" },
  { to: "/admin/ustawienia-email", label: "Ustawienia e-mail" },
  { to: "/admin/powiadomienia", label: "Historia powiadomień" },
  { to: "/admin/tresci", label: "Treści strony" },
] as const;

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

  if (isLoading) return <div className="p-10 text-muted-foreground">Sprawdzanie uprawnień…</div>;
  if (error || !data?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Brak dostępu</h1>
          <p className="text-sm text-muted-foreground">To konto nie ma uprawnień administratora.</p>
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
        <nav className="mt-6 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
              className="rounded px-3 py-2 text-sm text-foreground/80 hover:bg-accent"
              activeProps={{ className: "rounded px-3 py-2 text-sm bg-accent text-gold" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <p className="truncate">{data.email}</p>
          <Button variant="outline" size="sm" onClick={signOut}>Wyloguj</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-10"><Outlet /></main>
    </div>
  );
}
