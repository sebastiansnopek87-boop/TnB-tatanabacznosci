import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/tnb/SiteHeader";
import { Hero } from "@/components/tnb/Hero";
import { QuickNav } from "@/components/tnb/QuickNav";
import { PillarCards } from "@/components/tnb/PillarCards";
import { QuoteNewsletter } from "@/components/tnb/QuoteNewsletter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tata Na Baczności — Ojcostwo to służba" },
      {
        name: "description",
        content:
          "Przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Biblioteka, podcast, społeczność i spotkania 1:1.",
      },
      { property: "og:title", content: "Tata Na Baczności — Ojcostwo to służba" },
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
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <QuickNav />
      <PillarCards />
      <QuoteNewsletter />
    </main>
  );
}
