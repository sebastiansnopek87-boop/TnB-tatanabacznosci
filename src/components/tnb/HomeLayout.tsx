import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { Hero } from "./Hero";
import { HomeArticles, HomeConversations } from "./HomeSections";
import { QuickNav } from "./QuickNav";
import { PillarCards } from "./PillarCards";
import { QuoteNewsletter } from "./QuoteNewsletter";
import { SiteFooter } from "./SiteFooter";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { isLegacyHomeKind, type PageSection } from "@/lib/pages";
import type { BlockProps } from "./home-edit";

// Renders one formerly code-owned home block from its CMS copy.
export function LegacyHomeBlock({ s, sel, imageSrc }: BlockProps & { s: PageSection }) {
  const { visible } = useModuleVisibility();
  const p = { s, sel, imageSrc };
  switch (s.kind) {
    case "home-hero": return <Hero {...p} />;
    case "home-articles": return visible("articles") || sel !== undefined ? <HomeArticles {...p} /> : null;
    case "home-talks": return visible("community") || sel !== undefined ? <HomeConversations {...p} /> : null;
    case "quick-nav": return <QuickNav {...p} />;
    case "pillars": return <PillarCards {...p} />;
    case "quote-newsletter": return <QuoteNewsletter {...p} />;
    case "home-footer": return <SiteFooter home={s} sel={sel} />;
    default: return null;
  }
}

// Full mode = the home draft/publication contains the imported legacy blocks: every section comes from CMS.
export const isFullHome = (sections: PageSection[] | undefined) => !!sections?.some((s) => isLegacyHomeKind(s.kind));

// Legacy mode keeps the code-owned sections around additive CMS content (fallback when nothing imported).
export function HomeLayout({ children, sections, editing = false }: { children?: ReactNode; sections?: PageSection[] | undefined; editing?: boolean }) {
  const { visible } = useModuleVisibility();
  if (isFullHome(sections)) {
    const nav = sections!.some((s) => s.kind === "home-nav" && !s.hidden);
    const footer = sections!.some((s) => s.kind === "home-footer" && (editing || !s.hidden));
    return <main className="min-h-screen bg-background">
      {!nav && <SiteHeader />}
      {children}
      {!footer && <SiteFooter />}
    </main>;
  }
  return <main className="min-h-screen bg-background">
    <SiteHeader />
    {children}
    <Hero />
    {visible("articles") && <HomeArticles />}
    {visible("community") && <HomeConversations />}
    <QuickNav />
    <PillarCards />
    <QuoteNewsletter />
    <SiteFooter />
  </main>;
}
