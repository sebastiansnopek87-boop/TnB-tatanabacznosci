import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  adminCheckInstagramConfig, adminDisconnectInstagram, adminGetInstagram, adminListSubmissions,
  adminSaveInstagramOptions, adminStartInstagramConnect, adminSyncInstagram, adminUpdateSubmission,
  finishInstagramOAuth, listInstagram, storySchema, submitVoiceStory,
} from "./api/voice";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
});

describe("Voice TNB SPA contract", () => {
  it("routes all eleven browser actions through tnb-voice", async () => {
    await Promise.all([
      submitVoiceStory({ data: {
        name: "Jan Kowalski", email: "jan@example.com", phone: "", about: "", topic: "Rozmowa",
        story: "To jest przykładowa historia o długości ponad dwudziestu znaków.", why: "",
        profile_url: "", consent: true, website: "", elapsedMs: 3000,
      } }),
      adminListSubmissions(),
      adminUpdateSubmission({ data: { id: "00000000-0000-4000-8000-000000000001", status: "review", admin_note: "" } }),
      listInstagram(),
      adminGetInstagram(),
      adminCheckInstagramConfig(),
      adminStartInstagramConnect({ data: { origin: "https://tatanabacznosci.pl" } }),
      adminSyncInstagram(),
      adminDisconnectInstagram(),
      adminSaveInstagramOptions({ data: { show_reels: true, show_posts: true, show_carousels: false, display_count: 6 } }),
      finishInstagramOAuth({ data: { state: "12345678901234567890", code: "oauth-code" } }),
    ]);
    const actions = [
      "submitVoiceStory", "adminListSubmissions", "adminUpdateSubmission", "listInstagram", "adminGetInstagram",
      "adminCheckInstagramConfig", "adminStartInstagramConnect", "adminSyncInstagram", "adminDisconnectInstagram",
      "adminSaveInstagramOptions", "finishInstagramOAuth",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-voice", {
        body: expect.objectContaining({ action }),
      });
    }
  });

  it("validates story consent, content and length before the Edge request", () => {
    const valid = {
      name: "Jan Kowalski", email: "jan@example.com", phone: "", about: "", topic: "Rozmowa",
      story: "To jest przykładowa historia o długości ponad dwudziestu znaków.", why: "",
      profile_url: "", consent: true,
    };
    expect(storySchema.safeParse(valid).success).toBe(true);
    expect(storySchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(storySchema.safeParse({ ...valid, story: "krótko" }).success).toBe(false);
    expect(storySchema.safeParse({ ...valid, email: "błędny" }).success).toBe(false);
  });

  it("keeps all eleven browser actions plus the cron guard in the Edge schema and dispatcher", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-voice/index.ts", import.meta.url), "utf8");
    const actions = [
      "submitVoiceStory", "adminListSubmissions", "adminUpdateSubmission", "listInstagram", "adminGetInstagram",
      "adminCheckInstagramConfig", "adminStartInstagramConnect", "adminSyncInstagram", "adminDisconnectInstagram",
      "adminSaveInstagramOptions", "finishInstagramOAuth", "cronInstagramSync",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '":');
    }
    expect(edge).toContain("requireAdmin(s, req)");
    expect(edge).toContain("requireCron(s, req)");
    expect(edge).toContain("voice_submission_admin");
  });
});
