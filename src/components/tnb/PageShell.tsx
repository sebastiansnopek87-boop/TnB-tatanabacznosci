import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
      <p className="eyebrow text-gold">{eyebrow}</p>
      <h1 className="mt-4 font-display text-[2.6rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.4rem]">
        {title}
      </h1>
      {intro && <p className="mt-6 max-w-2xl text-[0.95rem] leading-[1.75] text-foreground/80">{intro}</p>}
    </div>
  );
}
