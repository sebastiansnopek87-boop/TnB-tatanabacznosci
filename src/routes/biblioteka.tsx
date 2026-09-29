import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, comingSoonHead } from "@/components/tnb/ComingSoon";

const DESC = "Artykuły i materiały o ojcostwie, relacjach i rozwoju.";

export const Route = createFileRoute("/biblioteka")({
  head: () => comingSoonHead("Biblioteka", DESC),
  component: () => <ComingSoon eyebrow="Wiedza dla ojców" title="Biblioteka" intro={DESC} />,
});
