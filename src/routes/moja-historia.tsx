import { createFileRoute } from "@tanstack/react-router";
import { getPublicPage } from "@/lib/pages.functions";
import { CmsPage, cmsHead } from "@/components/pages/CmsPageRoute";

const DESC = "Historia, która stoi za Tata Na Baczności — osobista opowieść Sebastiana.";

export const Route = createFileRoute("/moja-historia")({
  loader: () => getPublicPage({ data: { key: "moja-historia" } }),
  head: ({ loaderData }) => cmsHead(loaderData, "Moja historia", DESC, "/moja-historia"),
  component: () => <CmsPage page={Route.useLoaderData()} eyebrow="Tata Na Baczności" fallbackTitle="Moja historia" />,
  errorComponent: () => <CmsPage page={null} eyebrow="Tata Na Baczności" fallbackTitle="Moja historia" />,
});
