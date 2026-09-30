import { createFileRoute } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { CmsPage, cmsHead } from "@/components/pages/CmsPageRoute";

const DESC = "Czym jest Tata Na Baczności — społeczność ojców, mężów i mężczyzn, którzy wspierają się nawzajem.";

export const Route = createFileRoute("/o-tnb")({
  loader: () => getPublicPage({ data: { key: "o-tnb" } }),
  head: ({ loaderData }) => cmsHead(loaderData, "O TNB", DESC, "/o-tnb"),
  component: () => <CmsPage page={Route.useLoaderData()} eyebrow="Tata Na Baczności" fallbackTitle="O TNB" />,
  errorComponent: () => <CmsPage page={null} eyebrow="Tata Na Baczności" fallbackTitle="O TNB" />,
});
