import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  confirmNewsletter, NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION,
  newsletterSchema, subscribeNewsletter, unsubscribeNewsletter,
} from "./api/newsletter";

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("newsletter SPA contract", () => {
  it("keeps consent validation and routes subscribe, unsubscribe and confirmation actions", async () => {
    expect(newsletterSchema.safeParse({ email: "bad", consent: true }).success).toBe(false);
    expect(newsletterSchema.safeParse({ email: "a@example.com", consent: false }).success).toBe(false);
    expect(newsletterSchema.parse({ email: "  USER@EXAMPLE.COM ", consent: true })).toEqual({ email: "user@example.com", consent: true });
    const token = "00000000-0000-4000-8000-000000000002";
    await Promise.all([
      subscribeNewsletter({ data: { email: "user@example.com", consent: true, website: "", elapsedMs: 2000 } }),
      unsubscribeNewsletter({ data: { token } }),
      confirmNewsletter({ data: { token } }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenCalledWith("tnb-newsletter", {
      body: { action: "subscribe", data: { email: "user@example.com", consent: true, website: "", elapsedMs: 2000 } },
    });
    expect(invoke).toHaveBeenCalledWith("tnb-newsletter", { body: { action: "unsubscribe", data: { token } } });
    expect(invoke).toHaveBeenCalledWith("tnb-newsletter", { body: { action: "confirm", data: { token } } });
  });

  it("propagates Edge errors and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Zbyt wiele prób." }), { status: 429 }) },
    });
    await expect(subscribeNewsletter({ data: { email: "user@example.com", consent: true, elapsedMs: 2000 } }))
      .rejects.toThrow("Zbyt wiele prób.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(confirmNewsletter({ data: { token: "00000000-0000-4000-8000-000000000002" } }))
      .rejects.toThrow("pustą odpowiedź");
  });

  it("keeps consent version, anti-spam, rate limit, confirmation and unsubscribe rules in Edge", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-newsletter/index.ts", import.meta.url), "utf8");
    expect(edge).toContain(NEWSLETTER_CONSENT_VERSION);
    expect(edge).toContain(NEWSLETTER_CONSENT_TEXT);
    for (const action of ["subscribe", "unsubscribe", "confirm"]) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('parsed.data.action === "' + action + '"');
    }
    expect(edge).toContain("data.elapsedMs < 1500");
    expect(edge).toContain("data.website");
    expect(edge).toContain("count ?? 0) >= 5");
    expect(edge).toContain("newsletter_double_opt_in");
    expect(edge).toContain('eq("status", "pending")');
    expect(edge).toContain('eq("unsubscribe_token", data.token)');
    expect(edge).toContain("SHA-256");
  });
});
