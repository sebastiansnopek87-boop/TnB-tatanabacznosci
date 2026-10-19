import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/tnb/HomeLayout";
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
  const { data: page } = useSuspenseQuery(homeOptions);
  return (
    <HomeLayout>
      {page && <PageSections sections={page.sections.filter(s => s.kind !== "home-nav")} imageSrc={file => pageImageUrl(page.id, file)} />}
    </HomeLayout>
  );
}
