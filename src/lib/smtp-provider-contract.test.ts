import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../supabase/functions/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("Cyber_Folks SMTP provider contract", () => {
  it("keeps SMTP credentials server-side and rejects ports blocked by Supabase Edge", () => {
    const smtp = read("_shared/smtp.ts");
    expect(smtp).toContain('Deno.env.get("SMTP_HOST")');
    expect(smtp).toContain('Deno.env.get("SMTP_PORT")');
    expect(smtp).toContain('Deno.env.get("SMTP_USERNAME")');
    expect(smtp).toContain('Deno.env.get("SMTP_PASSWORD")');
    expect(smtp).toContain('env("SMTP_FROM")');
    expect(smtp).toContain("port === 25 || port === 587");
    expect(smtp).toContain('import nodemailer from "npm:nodemailer@^9"');
    expect(smtp).toContain("await transport(config).verify()");
    expect(smtp).toContain("await transport(config).sendMail");
  });

  it("uses the shared SMTP transport in every transactional mail Edge Function", () => {
    const functions = [
      "tnb-notifications/index.ts",
      "tnb-newsletter/index.ts",
      "tnb-article-newsletter/index.ts",
      "tnb-orders/index.ts",
      "tnb-consult/index.ts",
      "tnb-library-delivery/index.ts",
      "tnb-contact/index.ts",
    ];
    for (const path of functions) {
      expect(read(path)).toContain('from "../_shared/smtp.ts"');
    }
  });

  it("keeps live sending gated by the database setting and a complete SMTP secret set", () => {
    const functions = [
      "tnb-notifications/index.ts",
      "tnb-newsletter/index.ts",
      "tnb-article-newsletter/index.ts",
      "tnb-orders/index.ts",
      "tnb-consult/index.ts",
      "tnb-library-delivery/index.ts",
      "tnb-contact/index.ts",
    ];
    for (const path of functions) {
      const source = read(path);
      expect(source).toContain("smtpConfig()");
      expect(source).toContain('settings?.delivery_mode === "live"');
    }
  });

  it("does not commit SMTP credential values in the shared transport or setup guide", () => {
    const smtp = read("_shared/smtp.ts");
    const guide = readFileSync(new URL("../../docs/operations/smtp-cyberfolks.md", import.meta.url), "utf8");
    expect(smtp).not.toMatch(/(?:SMTP_PASSWORD|SMTP_PASS)\s*[:=]\s*["'][^"']{4,}["']/);
    expect(guide).toContain("Nie wpisuj hasła do plików");
    expect(guide).toContain("Authentication → SMTP Settings");
  });
});
