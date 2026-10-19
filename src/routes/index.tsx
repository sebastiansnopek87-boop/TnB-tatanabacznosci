import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/tnb/SiteHeader";
import { Hero } from "@/components/tnb/Hero";
import { HomeArticles, HomeConversations } from "@/components/tnb/HomeSections";
import { QuickNav } from "@/components/tnb/QuickNav";
import { PillarCards } from "@/components/tnb/PillarCards";
import { QuoteNewsletter } from "@/components/tnb/QuoteNewsletter";
import { SiteFooter } from "@/components/tnb/SiteFooter";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPublicPage } from "@/lib/pages.functions";
import { pageImageUrl } from "@/lib/pages";
import { PageSections } from "@/components/pages/PageView";

const homeOptions = queryOptions({ queryKey: ["public-page", "home"], queryFn: () => getPublicPage({ data: { key: "home" } }) });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOptions),
  head: ({ loaderData: page }) => ({
    meta: [
      { title: page?.seo_title || "Tata Na Baczności — Ojcostwo to służba" },
      {
        name: "description",
        content:
          page?.seo_description || "Przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Artykuły, rozmowy społeczności, biblioteka, Głos TNB i spotkania 1:1.",
      },
      { property: "og:title", content: page?.seo_title || "Tata Na Baczności — Ojcostwo to służba" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          page?.seo_description || "Czuwaj nad tym, co naprawdę ważne. Historie, rozmowy i materiały dla ojców i ludzi z zasadami.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { visible } = useModuleVisibility();
  const { data: page } = useSuspenseQuery(homeOptions);
  return (
    <main className="min-h-screen bg-background">
      {page ? <><PageSections sections={page.sections} imageSrc={file => pageImageUrl(page.id, file)} /></> : <><SiteHeader /><Hero /></>}
      {visible("articles") && <HomeArticles />}
      {visible("community") && <HomeConversations />}
      <QuickNav />
      <PillarCards />
      <QuoteNewsletter />
      <SiteFooter />
    </main>
  );
}
