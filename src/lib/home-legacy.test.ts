import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const c: any = { middleware: () => c, inputValidator: () => c, handler: () => () => null }; return c; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./admin-auth.server", () => ({ assertAdmin: vi.fn(), logEvent: vi.fn() }));
import { legacyHomeSections } from "./home-legacy";
import { shownFor } from "./pages";
import { DraftSection } from "./pages.functions";

describe("home page import", () => {
  it("keeps the existing sections in their public order", () => {
    expect(legacyHomeSections().map((s) => s.kind)).toEqual(["home-hero", "home-articles", "home-talks", "quick-nav", "pillars", "quote-newsletter", "home-footer"]);
  });
  it("keeps the existing texts and links", () => {
    const [hero, , , nav, pillars] = legacyHomeSections();
    expect(hero!.heading).toBe("Czuwaj");
    expect(hero!.buttons[0]).toMatchObject({ label: "Poznaj TNB", href: "/o-tnb" });
    expect(nav!.items).toHaveLength(7);
    expect(pillars!.items.filter((i) => i.variant === "card")).toHaveLength(3);
    expect(pillars!.items.filter((i) => i.variant === "tile")).toHaveLength(3);
  });
  it("every imported section passes server draft validation", () => {
    for (const s of legacyHomeSections()) expect(() => DraftSection.parse(s)).not.toThrow();
  });
});

describe("audience is presentation only", () => {
  it("all-audience sections show for everyone", () => { expect(shownFor({}, false)).toBe(true); expect(shownFor({ audience: "all" }, true)).toBe(true); });
  it("guest-only sections hide for signed-in users", () => { expect(shownFor({ audience: "guest" }, false)).toBe(true); expect(shownFor({ audience: "guest" }, true)).toBe(false); });
  it("member-only sections hide for guests and while loading", () => { expect(shownFor({ audience: "member" }, true)).toBe(true); expect(shownFor({ audience: "member" }, false)).toBe(false); expect(shownFor({ audience: "member" }, null)).toBe(false); });
});
