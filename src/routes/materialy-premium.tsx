import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, comingSoonHead } from "@/components/tnb/ComingSoon";

const DESC = "Materiały edukacyjne, publikacje i zasoby do pobrania dostępne w ramach członkostwa. Oferta jest w przygotowaniu.";

export const Route = createFileRoute("/materialy-premium")({
  head: () => comingSoonHead("Materiały premium", DESC),
  component: () => <ComingSoon eyebrow="Zasoby TNB" title="Materiały premium" intro={DESC} />,
});
