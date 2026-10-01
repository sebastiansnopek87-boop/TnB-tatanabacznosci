import { createFileRoute } from "@tanstack/react-router";

// Operator payment notification. Authenticity is verified inside handleWebhook
// (signature per operator docs) before any order change.
export const Route = createFileRoute("/api/public/payments/p24")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleWebhook } = await import("@/lib/orders.server");
    return handleWebhook("p24", request);
  } } },
});
