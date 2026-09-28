import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => legalHead("polityka-prywatnosci"),
  component: () => <LegalPageView slug="polityka-prywatnosci" />,
});
