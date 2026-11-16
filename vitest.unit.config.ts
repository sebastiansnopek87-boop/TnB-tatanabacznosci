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
      "src/lib/library-api.test.ts",
      "src/lib/smtp-provider-contract.test.ts",
      "src/lib/notify/render.test.ts",
      "src/lib/payments/providers.test.ts",
      "src/lib/platform.test.ts",
      "src/lib/rich-text.test.ts",
    ],
  },
});
