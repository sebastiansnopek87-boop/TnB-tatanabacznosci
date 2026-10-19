import { createFileRoute } from "@tanstack/react-router";
import { PageView } from "@/components/pages/PageView";
import { getPublicPage } from "@/lib/pages.functions";
import { pageImageUrl } from "@/lib/pages";
import { homeDefaultSections, usableHome } from "@/lib/home-content";

// "/" renders the published home record from the CMS when it is a complete home layout;
// otherwise the built-in content. Both go through the same renderer as the Visual Builder.
export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const p = await getPublicPage({ data: { key: "home" } });
      return p && usableHome(p.sections) ? { id: p.id, sections: p.sections } : null;
    } catch { return null; }
  },
  head: () => ({
    meta: [
      { title: "Tata Na Baczności — Ojcostwo to służba" },
      { name: "description", content: "Przestrzeń prawdziwych historii, rozmów, doświadczeń i wartości. Artykuły, rozmowy społeczności, biblioteka, Głos TNB i spotkania 1:1." },
      { property: "og:title", content: "Tata Na Baczności — Ojcostwo to służba" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Czuwaj nad tym, co naprawdę ważne. Historie, rozmowy i materiały dla ojców i ludzi z zasadami." },
    ],
  }),
  component: Index,
});

function Index() {
  const page = Route.useLoaderData();
  const sections = page?.sections ?? homeDefaultSections();
  return <PageView eyebrow="" title="" intro="" sections={sections} imageSrc={(f) => (page ? pageImageUrl(page.id, f) : undefined)} />;
}
