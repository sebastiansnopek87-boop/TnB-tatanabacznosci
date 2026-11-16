import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  adminCancelMeeting, adminGetMeeting, adminListMeetings, adminListRegistrations,
  adminRemoveMeetingImage, adminSaveMeeting, adminSetMeetingStatus, adminUpdateRegistration,
  adminUploadMeetingImage, cancelMyRegistration, getMeeting, getMyRegistration,
  getRegistrationByToken, listMeetings, listMyRegistrations, registerForMeeting,
} from "./api/meetings";

const id = "00000000-0000-4000-8000-000000000002";
const token = "00000000-0000-4000-8000-000000000003";

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("meetings SPA contract", () => {
  it("routes all seventeen public, user and admin actions through tnb-meetings", async () => {
    const meeting = {
      id: null, slug: "spotkanie-testowe", title: "Spotkanie testowe", kind: "online",
      summary: "Opis", description: "Opis dłuższy", rules: "", starts_at: "2026-12-01T10:00:00Z",
      ends_at: null, location: "", location_public: false, capacity: null, registration_open: true,
      requires_login: false, requires_approval: false, online_link: "", host: "", venue_name: "",
      address: "", map_url: "", equipment: "", fee_info: "", organizer_contact: "",
      cancellation_policy: "", is_outdoor: false, route_length: "", route_duration: "",
      difficulty: "", meeting_point: "", preparation: "", org_notes: "", join_open_minutes: 0,
      user_can_cancel: true, recording_url: "", recording_access: "participants",
    };
    const actions = [
      listMeetings(),
      getMeeting({ data: { slug: "spotkanie-testowe" } }),
      getMyRegistration({ data: { meetingId: id } }),
      listMyRegistrations(),
      cancelMyRegistration({ data: { token } }),
      registerForMeeting({ data: { meetingId: id, name: "Jan Kowalski", email: "jan@example.com", phone: "", message: "", consent: true, website: "", elapsedMs: 4000 } }),
      getRegistrationByToken({ data: { token } }),
      adminListMeetings(),
      adminGetMeeting({ data: { id } }),
      adminSaveMeeting({ data: meeting }),
      adminSetMeetingStatus({ data: { id, status: "published" } }),
      adminUploadMeetingImage({ data: { id, name: "cover.jpg", type: "image/jpeg", base64: "aGVsbG8=" } }),
      adminRemoveMeetingImage({ data: { id } }),
      adminListRegistrations({ data: { meetingId: id } }),
      adminUpdateRegistration({ data: { id, status: "approved", attended: false } }),
      adminCancelMeeting({ data: { id, reason: "Zmiana terminu spotkania" } }),
    ];
    await Promise.all(actions);
    const names = [
      "listMeetings", "getMeeting", "getMyRegistration", "listMyRegistrations",
      "cancelMyRegistration", "registerForMeeting", "getRegistrationByToken", "adminListMeetings",
      "adminGetMeeting", "adminSaveMeeting", "adminSetMeetingStatus", "adminUploadMeetingImage",
      "adminRemoveMeetingImage", "adminListRegistrations", "adminUpdateRegistration", "adminCancelMeeting",
    ];
    expect(invoke).toHaveBeenCalledTimes(names.length);
    for (const action of names) {
      expect(invoke).toHaveBeenCalledWith("tnb-meetings", {
        body: expect.objectContaining({ action }),
      });
    }
  });

  it("propagates Edge authorization and validation errors", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(adminListMeetings()).rejects.toThrow("Brak uprawnień administratora.");
  });

  it("keeps action parity, role sets, consent and upload boundaries explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-meetings/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./meetings.functions.ts", import.meta.url), "utf8");
    const names = [
      "listMeetings", "getMeeting", "getMyRegistration", "listMyRegistrations",
      "cancelMyRegistration", "registerForMeeting", "getRegistrationByToken", "adminListMeetings",
      "adminGetMeeting", "adminSaveMeeting", "adminSetMeetingStatus", "adminUploadMeetingImage",
      "adminRemoveMeetingImage", "adminListRegistrations", "adminUpdateRegistration", "adminCancelMeeting",
    ];
    for (const action of names) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("const ADMIN_ACTIONS=new Set");
    expect(edge).toContain("const AUTH_ACTIONS=new Set");
    expect(edge).toContain("ADMIN_ACTIONS.has(input.action)?await requireAdmin(s,req)");
    expect(edge).toContain("AUTH_ACTIONS.has(input.action)?await requireUser(s,req)");
    expect(edge).toContain('consent:z.literal(true');
    expect(edge).toContain("website");
    expect(edge).toContain("elapsedMs");
    expect(edge).toContain("base64:z.string().max(7000000)");
  });
});
