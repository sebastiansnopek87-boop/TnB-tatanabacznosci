import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, comingSoonHead } from "@/components/tnb/ComingSoon";

const DESC = "Rozmowy o ojcostwie, służbie i męskiej odpowiedzialności.";

export const Route = createFileRoute("/podcast")({
  head: () => comingSoonHead("Podcast", DESC),
  component: () => <ComingSoon eyebrow="Rozmowy TNB" title="Podcast" intro={DESC} />,
});
