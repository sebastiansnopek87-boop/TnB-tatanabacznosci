import { describe, expect, it } from "vitest";
import { homeDefaultSections, usableHome } from "./home-content";

describe("strona główna w CMS", () => {
  it("bez opublikowanego układu strony głównej / zostaje przy wbudowanej treści", () => {
    expect(usableHome(null)).toBe(false);
    expect(usableHome([])).toBe(false);
    // stary, nieobsługiwany układ zapisany wcześniej w bazie
    expect(usableHome([{ kind: "home-hero" }, { kind: "cinematic" }])).toBe(false);
  });
  it("same ukryte sekcje nie zastępują strony głównej", () => {
    expect(usableHome([{ kind: "home_hero", hidden: true }])).toBe(false);
  });
  it("szkic z obecnej strony zawiera wszystkie 7 sekcji w dotychczasowej kolejności", () => {
    expect(homeDefaultSections().map((s) => s.kind)).toEqual(["home_hero", "home_articles", "home_community", "home_quicknav", "home_pillars", "home_tiles", "home_quote_newsletter"]);
    expect(usableHome(homeDefaultSections())).toBe(true);
  });
});
