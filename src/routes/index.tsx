import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/tnb/SiteHeader";
import { Hero } from "@/components/tnb/Hero";
import { HomeArticles, HomeConversations } from "@/components/tnb/HomeSections";
import { QuickNav } from "@/components/tnb/QuickNav";
import { PillarCards } from "@/components/tnb/PillarCards";
import { QuoteNewsletter } from "@/components/tnb/QuoteNewsletter";
import { SiteFooter } from "@/components/tnb/SiteFooter";
import { useModuleVisibility } from "@/hooks/use-module-visibility";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tata Na Baczności — Ojcostwo to służba" },
      {
        name: "description",
        content:
          "Przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Artykuły, rozmowy społeczności, biblioteka, Głos TNB i spotkania 1:1.",
      },
      { property: "og:title", content: "Tata Na Baczności — Ojcostwo to służba" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Czuwaj nad tym, co naprawdę ważne. Historie, rozmowy i materiały dla ojców i ludzi z zasadami.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { visible } = useModuleVisibility();
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      {visible("articles") && <HomeArticles />}
      {visible("community") && <HomeConversations />}
      <QuickNav />
      <PillarCards />
      <QuoteNewsletter />
      <SiteFooter />
    </main>
  );
}
