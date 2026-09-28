import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/regulamin")({
  head: () => legalHead("regulamin"),
  component: () => <LegalPageView slug="regulamin" />,
});
