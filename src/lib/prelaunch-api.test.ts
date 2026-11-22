import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRELAUNCH_CONSENT_TEXT, PRELAUNCH_CONSENT_VERSION, prelaunchSignupSchema } from "@/lib/api/prelaunch";

describe("prelaunch signup consent", () => {
  it("requires first name, valid email and explicit consent", () => {
    expect(prelaunchSignupSchema.safeParse({ first_name: "Anna", email: "anna@example.com", consent: true }).success).toBe(true);
    expect(prelaunchSignupSchema.safeParse({ first_name: "A", email: "anna@example.com", consent: true }).success).toBe(false);
    expect(prelaunchSignupSchema.safeParse({ first_name: "Anna", email: "invalid", consent: true }).success).toBe(false);
    expect(prelaunchSignupSchema.safeParse({ first_name: "Anna", email: "anna@example.com", consent: false }).success).toBe(false);
  });

  it("uses a separate one-time launch consent, not newsletter consent", () => {
    expect(PRELAUNCH_CONSENT_VERSION).toBe("2026-11-22");
    expect(PRELAUNCH_CONSENT_TEXT).toContain("jednorazowej informacji");
    expect(PRELAUNCH_CONSENT_TEXT).toContain("Nie oznacza subskrypcji newslettera");
    const edgeSource = readFileSync("supabase/functions/tnb-newsletter/index.ts", "utf8");
    expect(edgeSource).toContain(PRELAUNCH_CONSENT_TEXT);
    expect(edgeSource).toContain(`const PRELAUNCH_CONSENT_VERSION = "${PRELAUNCH_CONSENT_VERSION}"`);
  });
});
