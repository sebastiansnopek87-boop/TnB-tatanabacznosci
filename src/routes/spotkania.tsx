import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, comingSoonHead } from "@/components/tnb/ComingSoon";

const DESC = "Spotkania na żywo dla ojców ze społeczności Tata Na Baczności.";

export const Route = createFileRoute("/spotkania")({
  head: () => comingSoonHead("Spotkania", DESC),
  component: () => <ComingSoon eyebrow="Spotkajmy się naprawdę" title="Spotkania" intro={DESC} />,
});
