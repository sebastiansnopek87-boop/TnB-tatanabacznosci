import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  confirmGuestComment, GUEST_COMMENT_RULES, resendGuestComment, submitGuestComment,
} from "./api/guest-comments";

const token = "guest-comment-confirmation-token-123456";
const data = {
  articleId: "00000000-0000-4000-8000-000000000002",
  firstName: "Jan", lastName: "Kowalski", email: "jan@example.com",
  body: "To jest treść komentarza.", rules: true as const, website: "", elapsedMs: 4000,
};

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { status: "check_email" }, error: null }));

describe("guest comments SPA contract", () => {
  it("routes submit, confirm and resend through tnb-guest-comments", async () => {
    await Promise.all([
      submitGuestComment({ data }),
      confirmGuestComment({ data: { token } }),
      resendGuestComment({ data: { token } }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenCalledWith("tnb-guest-comments", { body: { action: "submitGuestComment", data } });
    expect(invoke).toHaveBeenCalledWith("tnb-guest-comments", { body: { action: "confirmGuestComment", data: { token } } });
    expect(invoke).toHaveBeenCalledWith("tnb-guest-comments", { body: { action: "resendGuestComment", data: { token } } });
    expect(GUEST_COMMENT_RULES).toContain("piszę z szacunkiem");
  });

  it("preserves Edge errors and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Wysłano zbyt wiele komentarzy." }), { status: 429 }) },
    });
    await expect(submitGuestComment({ data })).rejects.toThrow("Wysłano zbyt wiele komentarzy.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(confirmGuestComment({ data: { token } })).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps consent, anti-spam, IP/email rate limits and hashed expiring one-use tokens in Edge and legacy", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-guest-comments/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./guest-comments.functions.ts", import.meta.url), "utf8");
    for (const action of ["submitGuestComment", "confirmGuestComment", "resendGuestComment"]) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain('rules: z.literal(true');
    expect(edge).toContain("data.elapsedMs < 3000");
    expect(edge).toContain("(lastMin ?? 0) >= 1 || (lastHour ?? 0) >= 5");
    expect(edge).toContain("(perEmail ?? 0) >= 5");
    expect(edge).toContain('eq("token_hash", await sha256(input.data.token))');
    expect(edge).toContain("TTL_HOURS = 48, MAX_SENDS = 3");
    expect(edge).toContain("10 * 60_000");
    expect(edge).toContain('.is("token_used_at", null)');
    expect(legacy).toContain("await sha256(data.token)");
    expect(legacy).toContain("await sha256(token)");
  });
});
