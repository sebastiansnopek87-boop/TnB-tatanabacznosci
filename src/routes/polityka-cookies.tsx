import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView, legalHead } from "@/components/tnb/LegalPageView";

export const Route = createFileRoute("/polityka-cookies")({
  head: () => legalHead("polityka-cookies"),
  component: () => <LegalPageView slug="polityka-cookies" />,
});
