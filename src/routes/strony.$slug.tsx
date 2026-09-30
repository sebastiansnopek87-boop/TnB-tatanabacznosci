import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { CmsPage, cmsHead } from "@/components/pages/CmsPageRoute";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";

// Additional CMS subpages created in the admin panel.
export const Route = createFileRoute("/strony/$slug")({
  loader: async ({ params }) => {
    if (!/^[a-z0-9-]{1,120}$/.test(params.slug)) throw notFound();
    const p = await getPublicPage({ data: { slug: params.slug } });
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData, params }) => cmsHead(loaderData, "Nie znaleziono", "Strona nie istnieje.", `/strony/${params.slug}`),
  component: () => <CmsPage page={Route.useLoaderData()} eyebrow="Tata Na Baczności" fallbackTitle="" />,
  notFoundComponent: NotFoundPage,
  errorComponent: NotFoundPage,
});

function NotFoundPage() {
  return <PageShell><PageHeading eyebrow="Tata Na Baczności" title="Nie znaleziono strony" intro="Ta strona nie istnieje lub nie jest opublikowana." /></PageShell>;
}
