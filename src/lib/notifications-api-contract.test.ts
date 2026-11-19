import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import {
  getLogPreview, getNotificationOverview, getTemplate, previewTemplate, resetTemplate,
  retryNotification, runDuplicateCheck, saveTemplate, sendTestMessage, setEventEnabled,
  updateDeliveryConfig,
} from "./api/notifications";

const id = "00000000-0000-4000-8000-000000000002";
const template = { key: "contact_message", subject: "Wiadomość", html: "<p>{{imie}}</p>", text: "{{imie}}" };

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("notifications SPA contract", () => {
  it("routes all notification actions through tnb-notifications with the current bearer token", async () => {
    await Promise.all([
      getNotificationOverview(),
      getTemplate({ data: { key: "contact_message" } }),
      previewTemplate({ data: { ...template, vars: { imie: "Jan" } } }),
      saveTemplate({ data: template }),
      resetTemplate({ data: { key: "contact_message" } }),
      setEventEnabled({ data: { key: "contact_message", enabled: true } }),
      updateDeliveryConfig({ data: { reply_to: null, delivery_mode: "test" } }),
      sendTestMessage({ data: { key: "contact_message", to: "admin@example.com", vars: { imie: "Jan" } } }),
      runDuplicateCheck(),
      retryNotification({ data: { id } }),
      getLogPreview({ data: { id } }),
    ]);
    const actions = [
      "getNotificationOverview", "getTemplate", "previewTemplate", "saveTemplate", "resetTemplate",
      "setEventEnabled", "updateDeliveryConfig", "sendTestMessage", "runDuplicateCheck",
      "retryNotification", "getLogPreview",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-notifications", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
    expect(invoke).toHaveBeenCalledWith("tnb-notifications", {
      body: { action: "getNotificationOverview" },
      headers: { Authorization: "Bearer admin-token" },
    });
  });

  it("blocks calls without a session and preserves Edge authorization errors", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getNotificationOverview()).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();

    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Tę zmianę może wykonać tylko superadministrator." }), { status: 403 }) },
    });
    await expect(saveTemplate({ data: template })).rejects.toThrow("Tę zmianę może wykonać tylko superadministrator.");
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(getNotificationOverview()).rejects.toThrow("pustą odpowiedź");
  });

  it("keeps Edge actions, admin/superadmin authorization and SMTP live-mode safeguards explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-notifications/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./notifications.functions.ts", import.meta.url), "utf8");
    const actions = [
      "getNotificationOverview", "getTemplate", "previewTemplate", "saveTemplate", "resetTemplate",
      "setEventEnabled", "updateDeliveryConfig", "sendTestMessage", "runDuplicateCheck",
      "retryNotification", "getLogPreview",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '"');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("const superOnly = new Set");
    expect(edge).toContain("const user = await requireRole(db, req, superOnly.has(input.action))");
    const privileged = edge.slice(edge.indexOf("const superOnly = new Set"), edge.indexOf("const user = await requireRole"));
    for (const action of ["saveTemplate", "resetTemplate", "setEventEnabled", "updateDeliveryConfig", "sendTestMessage", "runDuplicateCheck", "retryNotification"]) {
      expect(privileged).toContain('"' + action + '"');
    }
    expect(privileged).not.toContain('"getNotificationOverview"');
    expect(privileged).not.toContain('"getLogPreview"');
    expect(edge).toContain("await verifySmtp()");
    expect(edge).toContain('if (!smtpConfig().configured)');
    expect(edge).toContain("maskSensitive");
    expect(edge).toContain("retryable");
    expect(edge).toContain("status !== \"failed\"");
  });
});
