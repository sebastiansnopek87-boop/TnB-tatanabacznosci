import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { Hero } from "./Hero";
import { HomeArticles, HomeConversations } from "./HomeSections";
import { QuickNav } from "./QuickNav";
import { PillarCards } from "./PillarCards";
import { QuoteNewsletter } from "./QuoteNewsletter";
import { SiteFooter } from "./SiteFooter";
import { useModuleVisibility } from "@/hooks/use-module-visibility";

// CMS content is additive; existing content and access rules remain unchanged.
export function HomeLayout({ children }: { children?: ReactNode }) {
  const { visible } = useModuleVisibility();
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