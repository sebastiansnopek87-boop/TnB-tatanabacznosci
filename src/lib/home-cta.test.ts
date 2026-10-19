import { describe, expect, it } from "vitest";
import { resolveHomeCta } from "./home-cta";
const s = { ctaLabel: "DOŁĄCZ DO SPOŁECZNOŚCI", ctaHref: "/spolecznosc" };
describe("przycisk społeczności", () => {
  it("gość trafia do rejestracji także w starszym szkicu", () => {
    expect(resolveHomeCta(s, "signed-out")).toEqual({ href: "/auth?tryb=rejestracja", visible: true });
  });
  it("zalogowany trafia do rozmów", () => {
    expect(resolveHomeCta(s, "signed-in")).toEqual({ href: "/spolecznosc", visible: true });
  });
  it("stosuje osobne zapisane adresy", () => {
    const settings = { ...s, ctaGuestHref: "/auth", ctaMemberHref: "/moje-tnb" };
    expect(resolveHomeCta(settings, "signed-out").href).toBe("/auth");
    expect(resolveHomeCta(settings, "signed-in").href).toBe("/moje-tnb");
  });
  it("stały adres nie zależy od sesji", () => {
    for (const status of ["signed-in", "signed-out", "loading"] as const)
      expect(resolveHomeCta({ ...s, ctaMode: "fixed", ctaHref: "/o-tnb" }, status)).toEqual({ href: "/o-tnb", visible: true });
  });
  it("wyłączony przycisk jest ukryty", () => {
    expect(resolveHomeCta({ ...s, ctaVisible: "off" }, "signed-in").visible).toBe(false);
  });
  it("nie tworzy aktywnych niebezpiecznych linków", () => {
    for (const href of ["javascript:alert(1)", "//evil.example", "data:text/html,x", "/\\evil.example"])
      for (const status of ["signed-in", "signed-out"] as const)
        expect(resolveHomeCta({ ...s, ctaGuestHref: href, ctaMemberHref: href }, status).visible).toBe(false);
  });
  it("czeka na odczyt prawdziwej sesji", () => {
    expect(resolveHomeCta(s, "loading").visible).toBe(false);
  });
});