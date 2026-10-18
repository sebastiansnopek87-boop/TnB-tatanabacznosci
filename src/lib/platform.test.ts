import { describe, expect, it } from "vitest";
import { platformSchema } from "./platform.functions";

const BASE = {
  social_youtube: "", social_spotify: "", social_tiktok: "", social_instagram: "",
  platform_name: "Tata Na Baczności",
  contact_email: "", support_email: "",
  notice_enabled: false, maintenance_enabled: false, maintenance_message: "",
  company_legal_name: "", company_legal_form: "", company_nip: "", company_regon: "", company_krs: "",
  company_address_street: "", company_address_postal: "", company_address_city: "", company_address_country: "",
  contact_phone: "", contact_hours: "",
  billing_same_as_company: true, billing_name: "", billing_nip: "", billing_address: "",
  footer_description: "", footer_copyright: "", footer_show_contact: true,
};

describe("platformSchema", () => {
  it("normalizuje puste wartości opcjonalne do null", () => {
    const r = platformSchema.parse(BASE);
    expect(r.company_nip).toBeNull();
    expect(r.contact_phone).toBeNull();
    expect(r.footer_description).toBeNull();
    expect(r.billing_name).toBeNull();
  });

  it("odrzuca NIP w złym formacie", () => {
    expect(() => platformSchema.parse({ ...BASE, company_nip: "123-456" })).toThrow();
    expect(platformSchema.parse({ ...BASE, company_nip: "1234567890" }).company_nip).toBe("1234567890");
  });

  it("odrzuca kod pocztowy w złym formacie", () => {
    expect(() => platformSchema.parse({ ...BASE, company_address_postal: "12345" })).toThrow();
    expect(platformSchema.parse({ ...BASE, company_address_postal: "12-345" }).company_address_postal).toBe("12-345");
  });

  it("wymaga nazwy nabywcy, gdy dane do faktury nie są kopiowane z podmiotu", () => {
    expect(() => platformSchema.parse({ ...BASE, billing_same_as_company: false })).toThrow();
    expect(platformSchema.parse({ ...BASE, billing_same_as_company: false, billing_name: "Nabywca Sp. z o.o." }).billing_name).toBe("Nabywca Sp. z o.o.");
  });
});

describe("pola publiczne", () => {
  it("PUBLIC_COLS nie zawiera pól fakturowych", async () => {
    const src = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./platform.functions.ts", import.meta.url), "utf8"));
    const m = src.match(/const PUBLIC_COLS = "([^"]+)"/);
    expect(m).toBeTruthy();
    const cols = m![1];
    expect(cols).not.toContain("billing_");
    expect(cols).toContain("company_legal_name");
    expect(cols).toContain("contact_phone");
    expect(cols).toContain("footer_description");
  });
});
