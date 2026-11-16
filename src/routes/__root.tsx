import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent } from "@tanstack/react-router";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { MaintenanceGate } from "@/components/tnb/MaintenanceGate";
import { VisualEffects } from "@/components/tnb/VisualEffects";
import { ModuleGate } from "@/components/tnb/ModuleGate";
import { brandSrc, useBrand } from "@/hooks/use-brand-settings";

// Applies admin-set branding (favicon, share image, homepage SEO) to the document head.
// Public brand asset URLs are served through Supabase Edge Functions and validated
// against the active platform_settings.brand_settings references.
function BrandHead() {
  const brand = useBrand();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!brand) return;
    const src = (v: string) => brandSrc(v) ?? "";
    if (brand.favicon) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = src(brand.favicon);
    }
    if (brand.og_image) {
      const abs = new URL(src(brand.og_image), window.location.origin).href;
      if (!document.querySelector('meta[property="og:image"]')) {
        const add = (attr: string, key: string, content: string) => {
          const m = document.createElement("meta");
          m.setAttribute(attr, key);
          m.setAttribute("content", content);
          document.head.appendChild(m);
        };
        add("property", "og:image", abs);
        add("name", "twitter:image", abs);
      }
    }
    if (path === "/") {
      if (brand.public_title) {
        document.title = brand.public_title;
        document.querySelector('meta[property="og:title"]')?.setAttribute("content", brand.public_title);
      }
      if (brand.public_description) {
        document.querySelector('meta[name="description"]')?.setAttribute("content", brand.public_description);
        document.querySelector('meta[property="og:description"]')?.setAttribute("content", brand.public_description);
      }
    }
  }, [brand, path]);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // A recovery link may land on any page (e.g. the site root) — always finish it on the reset screen.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        router.navigate({ to: "/reset-password", replace: true });
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      {createPortal(<HeadContent />, document.head)}
      <BrandHead />
      <VisualEffects />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <MaintenanceGate><ModuleGate><Outlet /></ModuleGate></MaintenanceGate>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
