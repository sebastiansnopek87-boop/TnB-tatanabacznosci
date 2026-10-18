import { createFileRoute } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/regulamin")({
  loader: () => getPublicPage({ data: { key: "regulamin" } }),
  head: ({ loaderData }) => legalHead("regulamin", loaderData),
  component: () => <LegalPageView slug="regulamin" page={Route.useLoaderData()} />,
  errorComponent: () => <LegalPageView slug="regulamin" page={null} />,
});
