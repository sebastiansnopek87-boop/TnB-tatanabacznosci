import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/logo.png.asset.json";
import { brandSrc, useBrand } from "@/hooks/use-brand-settings";

/** Shared frame for every authentication screen: logo above a centred card. */
export function AuthShell({ step, title, lead, children, footer }: {
  step: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const brand = useBrand();
  const logoSrc = brandSrc(brand?.logo) || logo.url;
  return (
    <div className="auth-backdrop relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden px-5 py-12 sm:py-16">
      <Link to="/" aria-label="Tata Na Baczności — strona główna" className="animate-in fade-in duration-700">
        <img src={logoSrc} alt="Tata Na Baczności" className="h-auto w-28 object-contain sm:w-36" />
      </Link>
      <div className="mt-8 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="relative border border-border/70 bg-card/80 p-7 shadow-2xl backdrop-blur-sm sm:p-10">
          <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="eyebrow text-gold">{step}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold uppercase leading-tight text-foreground sm:text-4xl">{title}</h1>
          {lead && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lead}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthNotice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  const cls = tone === "ok"
    ? "border-primary/50 bg-primary/10 text-foreground"
    : tone === "error"
      ? "border-destructive/60 bg-destructive/10 text-foreground"
      : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 text-sm leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

/** Reads Supabase error/type parameters that auth links append to the URL hash or query. */
export function readAuthUrlParams(): { type: string | null; errorCode: string | null } {
  if (typeof window === "undefined") return { type: null, errorCode: null };
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const q = new URLSearchParams(window.location.search);
  return {
    type: h.get("type") ?? q.get("type"),
    errorCode: h.get("error_code") ?? q.get("error_code") ?? h.get("error") ?? q.get("error"),
  };
}
