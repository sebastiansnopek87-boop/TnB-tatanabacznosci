import { describe, expect, it } from "vitest";
import { render, maskSensitive, stripSensitive } from "./render";
import { DEFAULT_TEMPLATES, EVENTS, sampleVars } from "./registry";

describe("render", () => {
  it("substitutes variables and escapes HTML", () => {
    const r = render({ subject: "Hej {{imie}}", html: "<p>{{imie}}</p>", text: "{{imie}}" }, { imie: "<b>Jan</b>" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.subject).toBe("Hej <b>Jan</b>");
      expect(r.html).toContain("&lt;b&gt;Jan&lt;/b&gt;");
      expect(r.text).toBe("<b>Jan</b>");
    }
  });
  it("fails on missing variable instead of leaving a raw marker", () => {
    const r = render({ subject: "Zam {{numer_zamowienia}}", html: "<p>{{kwota}}</p>", text: "" }, { kwota: "10 zł" });
    expect(r).toEqual({ ok: false, missing: ["numer_zamowienia"] });
  });
  it("fails on unknown variable and on non-http link", () => {
    expect(render({ subject: "{{nieznana}}", html: "", text: "" }, { nieznana: "x" }).ok).toBe(false);
    expect(render({ subject: "", html: '<a href="{{link_do_logowania}}">x</a>', text: "" }, { link_do_logowania: "javascript:alert(1)" }).ok).toBe(false);
  });
  it("enforces required variables even if absent from text", () => {
    expect(render({ subject: "x", html: "", text: "" }, {}, ["imie"])).toEqual({ ok: false, missing: ["imie"] });
  });
  it("every default template renders with sample data", () => {
    for (const e of EVENTS) {
      const t = DEFAULT_TEMPLATES[e.key]!;
      const r = render(t, sampleVars(), t.required);
      expect(r.ok, e.key).toBe(true);
      if (r.ok) expect(r.html + r.text + r.subject).not.toMatch(/\{\{/);
    }
  });
  it("masks and strips sensitive links", () => {
    expect(maskSensitive({ link_do_potwierdzenia: "https://x/t?token=1" })["link_do_potwierdzenia"]).not.toContain("token");
    expect(stripSensitive({ link_do_spotkania: "https://x", imie: "Jan" })).toEqual({ imie: "Jan" });
  });
});
