import { createFileRoute } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/polityka-cookies")({
  loader: () => getPublicPage({ data: { key: "polityka-cookies" } }),
  head: ({ loaderData }) => legalHead("polityka-cookies", loaderData),
  component: () => <LegalPageView slug="polityka-cookies" page={Route.useLoaderData()} />,
  errorComponent: () => <LegalPageView slug="polityka-cookies" page={null} />,
});
