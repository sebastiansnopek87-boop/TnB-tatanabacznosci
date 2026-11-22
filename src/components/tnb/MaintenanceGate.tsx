import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { PrelaunchPage } from "./PrelaunchPage";

// Paths that always stay reachable so administrators can sign in and switch maintenance off.
const EXEMPT = [/^\/admin(\/|$)/, /^\/auth(\/|$)/, /^\/reset-password/, /^\/api\//, /^\/polityka-prywatnosci$/, /^\/polityka-cookies$/, /^\/regulamin$/, /^\/newsletter\//];

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
    return <PrelaunchPage message={s.maintenance_message} platformName={s.platform_name} />;
  }
  const banner = s.maintenance_enabled
    ? "Tryb przedpremierowy jest włączony — goście widzą stronę zapowiedzi. Ty widzisz pełną platformę jako administrator."
    : s.notice_enabled ? s.maintenance_message : null;
  return (
    <>
      {banner && <div role="status" className="border-b border-gold/50 bg-gold/10 px-5 py-2 text-center text-sm text-foreground">{banner}</div>}
      {children}
    </>
  );
}
