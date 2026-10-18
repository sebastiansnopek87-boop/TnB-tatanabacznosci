import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests exercise handlers directly, without the application's RPC transform.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/lib/control-center*.test.ts"] },
});