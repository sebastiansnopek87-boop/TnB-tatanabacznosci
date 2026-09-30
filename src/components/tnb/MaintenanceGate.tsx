import { useQuery } from "@tanstack/react-query";
import { useRouterState, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/use-platform-settings";

// Paths that always stay reachable so administrators can sign in and switch maintenance off.
const EXEMPT = [/^\/admin(\/|$)/, /^\/auth(\/|$)/, /^\/reset-password/, /^\/api\//];

function useIsAdmin() {
  const auth = useAuth();
  const uid = auth.user?.id ?? null;
  return useQuery({
    queryKey: ["is-admin-self", uid],
    enabled: auth.status !== "loading",
    queryFn: async () => {
      if (!uid) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      return !!data;
    },
    staleTime: 5 * 60_000,
  });
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { data: s } = usePlatformSettings();
  const exempt = EXEMPT.some((r) => r.test(path));
  const { data: isAdmin } = useIsAdmin();

  if (!s || exempt) return <>{children}</>;
  if (s.maintenance_enabled && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-lg space-y-4 text-center">
          <p className="eyebrow text-gold">{s.platform_name}</p>
          <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Przerwa techniczna</h1>
          <p className="whitespace-pre-line text-muted-foreground">{s.maintenance_message}</p>
          <Link to="/auth" className="inline-block text-xs text-muted-foreground underline hover:text-gold">Logowanie administratora</Link>
        </div>
      </div>
    );
  }
  const banner = s.maintenance_enabled
    ? "Tryb konserwacji jest włączony — odwiedzający widzą ekran przerwy technicznej. Ty widzisz stronę jako administrator."
    : s.notice_enabled ? s.maintenance_message : null;
  return (
    <>
      {banner && <div role="status" className="border-b border-gold/50 bg-gold/10 px-5 py-2 text-center text-sm text-foreground">{banner}</div>}
      {children}
    </>
  );
}
