import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function ModuleGate({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: r => r.location.pathname });
  const { visiblePath } = useModuleVisibility();
  if (visiblePath(path)) return <>{children}</>;
  return <><SiteHeader /><main className="min-h-[50vh] px-5 py-20 text-center">
    <h1 className="font-display text-3xl uppercase">Ta sekcja jest obecnie niedostępna</h1>
    <Link to="/" className="mt-6 inline-block text-gold underline">Wróć na stronę główną</Link>
  </main><SiteFooter /></>;
}