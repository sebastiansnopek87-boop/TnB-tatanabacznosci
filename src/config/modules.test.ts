import { describe, expect, it } from "vitest";
import { moduleForPath, moduleVisible } from "./modules";

describe("module presentation", () => {
  it("matches catalogue and detail paths, but never admin or payments", () => {
    expect(moduleForPath("/podcast/test")).toBe("voice");
    expect(moduleForPath("/biblioteka?dostep=premium")).toBe("library");
    expect(moduleForPath("/admin/podcast")).toBeUndefined();
    expect(moduleForPath("/zakup/token")).toBeUndefined();
  });
  it("gives the 1:1 submodule precedence", () => {
    expect(moduleForPath("/spotkania/rozmowa-1-1")).toBe("consult");
    expect(moduleForPath("/spotkania/wydarzenie")).toBe("meetings");
  });
  it("keeps independent visibility flags and defaults to visible", () => {
    const settings = { voice: { menu: false, page: true } };
    expect(moduleVisible(settings, "voice", "menu")).toBe(false);
    expect(moduleVisible(settings, "voice", "page")).toBe(true);
    expect(moduleVisible(undefined, "articles", "page")).toBe(true);
  });
});