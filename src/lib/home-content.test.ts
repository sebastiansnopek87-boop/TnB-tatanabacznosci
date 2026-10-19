import { describe, expect, it } from "vitest";
import { HOME_FIELDS, HOME_ITEM_FIELDS, homeDefaultSections, newHomeSection, usableHome } from "./home-content";
import { canInsert } from "@/components/pages/builder/registry";

describe("strona główna w CMS", () => {
  it("nowe otwarcie jest osobnym blokiem pięciu scen, bez zmiany siedmiu sekcji publicznego fallbacku", () => {
    const section = newHomeSection("home_cinematic");
    expect(section.items).toHaveLength(5);
    expect(HOME_ITEM_FIELDS.home_cinematic?.fixed).toBe(true);
    expect(homeDefaultSections().some((s) => s.kind === "home_cinematic")).toBe(false);
    expect(HOME_FIELDS.home_cinematic.length).toBeLessThanOrEqual(40);
    expect(new Set(HOME_FIELDS.home_cinematic.map((f) => f.key)).size).toBe(HOME_FIELDS.home_cinematic.length);
  });
  it("filmowe otwarcie wstawia się tylko na początku", () => {
    expect(canInsert("home_cinematic", 0)).toBe(true);
    expect(canInsert("home_cinematic", 1)).toBe(false);
  });
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
