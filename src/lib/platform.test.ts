import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("public platform settings access", () => {
  it("requests only explicitly public platform columns", async () => {
    const source = await readFile(new URL("./api/platform.ts", import.meta.url), "utf8");
    const match = source.match(/const PUBLIC_PLATFORM_COLUMNS =[^"]*"([^"]+)"/);
    expect(match).toBeTruthy();
    const columns = (match?.[1] ?? "").split(",").map((column) => column.trim());
    expect(columns).toContain("platform_name");
    expect(columns).toContain("module_visibility");
    expect(columns).toContain("company_legal_name");
    for (const privateColumn of ["billing_name", "billing_nip", "billing_address", "updated_by", "updated_at"]) {
      expect(columns).not.toContain(privateColumn);
    }
  });
});
