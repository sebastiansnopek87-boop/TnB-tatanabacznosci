import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: [
      "src/config/modules.test.ts",
      "src/lib/avatar-rules.test.ts",
      "src/lib/consult.test.ts",
      "src/lib/consult-api.test.ts",
      "src/lib/orders-payments-api.test.ts",
      "src/lib/recommend-api.test.ts",
      "src/lib/payment-webhook-reference.test.ts",
      "src/lib/library-api.test.ts",
      "src/lib/smtp-provider-contract.test.ts",
      "src/lib/notify/render.test.ts",
      "src/lib/payments/providers.test.ts",
      "src/lib/platform.test.ts",
      "src/lib/platform-api.test.ts",
      "src/lib/admin-api.test.ts",
      "src/lib/users-api.test.ts",
      "src/lib/notifications-api-contract.test.ts",
      "src/lib/newsletter-api-contract.test.ts",
      "src/lib/contact-api-contract.test.ts",
      "src/lib/article-newsletter-api-contract.test.ts",
      "src/lib/rich-text.test.ts",
    ],
  },
});
