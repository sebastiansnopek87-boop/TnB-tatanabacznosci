import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, comingSoonHead } from "@/components/tnb/ComingSoon";

const DESC = "Historia, która stoi za Tata Na Baczności — od munduru do ojcostwa.";

export const Route = createFileRoute("/moja-historia")({
  head: () => comingSoonHead("Moja historia", DESC),
  component: () => <ComingSoon eyebrow="Tata Na Baczności" title="Moja historia" intro={DESC} />,
});
