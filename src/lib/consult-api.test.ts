import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  adminBlockDate,
  adminGetAvailability,
  adminGetBooking,
  adminListBookings,
  adminSaveAvailability,
  adminUpdateBooking,
  cancelMyBooking,
  createConsultBooking,
  getBookingByToken,
  getConsultSlots,
  listMyBookings,
} from "./api/consult";

const actions = [
  "getConsultSlots",
  "createConsultBooking",
  "getBookingByToken",
  "listMyBookings",
  "cancelMyBooking",
  "adminListBookings",
  "adminGetBooking",
  "adminUpdateBooking",
  "adminGetAvailability",
  "adminSaveAvailability",
  "adminBlockDate",
] as const;

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("consult SPA adapter contract", () => {
  it("keeps all adapter actions represented by both the legacy contract and Edge Function", () => {
    const legacy = readFileSync(new URL("./consult.functions.ts", import.meta.url), "utf8");
    const edge = readFileSync(new URL("../../supabase/functions/tnb-consult/index.ts", import.meta.url), "utf8");

    for (const action of actions) {
      expect(legacy).toContain("export const " + action + " =");
      expect(edge).toContain("case \"" + action + "\":");
    }
  });

  it("targets the single tnb-consult Edge Function for every operation", async () => {
    const input = { startsAt: "2026-11-20T10:00:00.000Z", first_name: "Jan", last_name: "Kowalski", email: "jan@example.com", topic: "Rozmowa", reason: "Powód", question: "Pytanie", consent: true as const };
    const calls: Array<Promise<unknown>> = [
      getConsultSlots(),
      createConsultBooking({ data: input }),
      getBookingByToken({ data: { token: "11111111-1111-4111-8111-111111111111" } }),
      listMyBookings(),
      cancelMyBooking({ data: { id: "11111111-1111-4111-8111-111111111111", reason: "Zmieniły się moje plany." } }),
      adminListBookings({ data: { from: null, to: null, status: null } }),
      adminGetBooking({ data: { id: "11111111-1111-4111-8111-111111111111" } }),
      adminUpdateBooking({ data: { id: "11111111-1111-4111-8111-111111111111", action: "completed" } }),
      adminGetAvailability(),
      adminSaveAvailability({ data: { intervals: [], defaultLink: "" } }),
      adminBlockDate({ data: { day: "2026-11-20" } }),
    ];
    await Promise.all(calls);

    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-consult", {
        body: action === "getConsultSlots" || action === "listMyBookings" || action === "adminGetAvailability"
          ? { action }
          : expect.objectContaining({ action, data: expect.any(Object) }),
      });
    }
  });

  it("preserves adapter errors instead of returning a false success", async () => {
    const failure = new Error("Sesja wygasła");
    invoke.mockResolvedValueOnce({ data: null, error: failure });
    await expect(getConsultSlots()).rejects.toBe(failure);
  });
});
