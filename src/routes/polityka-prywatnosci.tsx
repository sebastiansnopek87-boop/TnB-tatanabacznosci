import { createFileRoute } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/polityka-prywatnosci")({
  loader: () => getPublicPage({ data: { key: "polityka-prywatnosci" } }),
  head: ({ loaderData }) => legalHead("polityka-prywatnosci", loaderData),
  component: () => <LegalPageView slug="polityka-prywatnosci" page={Route.useLoaderData()} />,
  errorComponent: () => <LegalPageView slug="polityka-prywatnosci" page={null} />,
});
