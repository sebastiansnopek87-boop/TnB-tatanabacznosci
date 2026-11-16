import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession, getUser, rpc } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession, getUser },
    functions: { invoke },
    rpc,
  },
}));

import {
  controlCenterHistory,
  controlCenterSearch,
  getAdminStatus,
  getDashboard,
  getEmailSettings,
  listAdminEvents,
  listCommunity,
  listMessages,
  listNotificationLog,
  listReports,
  listSubscribers,
  moderateCommunity,
  resolveReport,
  setMessageStatus,
  updateEmailSettings,
} from "./api/admin";

const emailSettings = {
  notification_recipient: "admin@example.com",
  sender_name: "TNB",
  sender_local_part: "kontakt",
  sender_domain: "example.com",
  admin_inbox_url: "https://example.com/admin",
  contact_notifications_enabled: true,
  newsletter_notifications_enabled: true,
  newsletter_double_opt_in: false,
};

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-4000-8000-000000000001", email: "admin@example.com" } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe("admin and control-center SPA contract", () => {
  it("routes every admin action through tnb-admin with the current bearer token", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    await Promise.all([
      getDashboard(),
      listMessages({ data: { status: "inbox", q: "test", sort: "desc" } }),
      setMessageStatus({ data: { id, status: "read" } }),
      listSubscribers({ data: { status: "active", q: "test" } }),
      getEmailSettings(),
      updateEmailSettings({ data: emailSettings }),
      listNotificationLog({ data: { kind: "newsletter", status: "failed" } }),
      listCommunity({ data: { status: "published" } }),
      moderateCommunity({ data: { action: "hide", id } }),
      listReports(),
      resolveReport({ data: { id } }),
      listAdminEvents({ data: { result: "failed", page: 0 } }),
      controlCenterSearch({ data: { q: "test" } }),
      controlCenterHistory({ data: { kind: "order", id, offsets: { order: 0, admin: 0, mail: 0 } } }),
    ]);

    const actions = [
      "getDashboard", "listMessages", "setMessageStatus", "listSubscribers",
      "getEmailSettings", "updateEmailSettings", "listNotificationLog", "listCommunity",
      "moderateCommunity", "listReports", "resolveReport", "listAdminEvents",
      "controlCenterSearch", "controlCenterHistory",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-admin", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("does not call privileged actions without a valid session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getDashboard()).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves Edge authorization errors and rejects empty responses", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge request failed", context: new Response(JSON.stringify({ message: "Brak uprawnień administratora." }), { status: 403 }) },
    });
    await expect(getDashboard()).rejects.toThrow("Brak uprawnień administratora.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getDashboard()).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps the admin navigation guard tied to the authenticated user's role", async () => {
    await expect(getAdminStatus()).resolves.toEqual({ isAdmin: true, email: "admin@example.com" });
    expect(getUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("has_role", {
      _user_id: "00000000-0000-4000-8000-000000000001",
      _role: "admin",
    });
  });

  it("matches the SPA, Edge allowlist, legacy action set, validation and server-side role boundary", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-admin/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./admin.functions.ts", import.meta.url), "utf8");
    const controlLegacy = readFileSync(new URL("./control-center.functions.ts", import.meta.url), "utf8");
    const actions = [
      "getDashboard", "listMessages", "setMessageStatus", "listSubscribers",
      "getEmailSettings", "updateEmailSettings", "listNotificationLog", "listCommunity",
      "moderateCommunity", "listReports", "resolveReport", "listAdminEvents",
      "controlCenterSearch", "controlCenterHistory",
    ];

    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
    }
    for (const action of actions.slice(0, 12)) expect(legacy).toContain("export const " + action + " =");
    expect(controlLegacy).toContain("export const controlCenterSearch =");
    expect(controlLegacy).toContain("export const controlCenterHistory =");
    expect(edge).toContain("const needsSuperadmin = input.action === \"updateEmailSettings\"");
    expect(edge).toContain("const user = await requireAdmin(db, req, needsSuperadmin)");
    expect(edge).toContain("if (status >= 500) console.error(\"tnb-admin error:\"");
    expect(edge).toContain('z.string().uuid()');
    expect(edge).toContain('z.string().trim().min(2').toContain('max(100)');
  });
});
