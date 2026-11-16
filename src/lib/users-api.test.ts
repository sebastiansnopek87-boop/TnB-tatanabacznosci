import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import { getUserDetail, listUsers, setUserRole } from "./api/users";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
});

describe("users SPA contract", () => {
  it("routes list, detail and role changes through tnb-users with the bearer token", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    await Promise.all([
      listUsers({ data: { q: "jan", role: "admin", status: "confirmed", page: 0 } }),
      getUserDetail({ data: { id } }),
      setUserRole({ data: { id, role: "moderator", grant: true } }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenCalledWith("tnb-users", {
      body: { action: "listUsers", q: "jan", role: "admin", status: "confirmed", page: 0 },
      headers: { Authorization: "Bearer admin-token" },
    });
    expect(invoke).toHaveBeenCalledWith("tnb-users", {
      body: { action: "getUserDetail", id },
      headers: { Authorization: "Bearer admin-token" },
    });
    expect(invoke).toHaveBeenCalledWith("tnb-users", {
      body: { action: "setUserRole", id, role: "moderator", grant: true },
      headers: { Authorization: "Bearer admin-token" },
    });
  });

  it("blocks calls without a session and preserves authorization errors", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(listUsers({ data: { q: "", role: "", status: "", page: 0 } })).rejects.toThrow("Sesja wygasła");
    expect(invoke).not.toHaveBeenCalled();

    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge request failed", context: new Response(JSON.stringify({ message: "Tylko superadministrator może zmieniać role." }), { status: 403 }) },
    });
    await expect(setUserRole({ data: { id: "00000000-0000-4000-8000-000000000002", role: "admin", grant: true } }))
      .rejects.toThrow("Tylko superadministrator może zmieniać role.");
  });

  it("keeps the Edge action schema, role gates and role invariants explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-users/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./users.functions.ts", import.meta.url), "utf8");
    for (const action of ["listUsers", "getUserDetail", "setUserRole"]) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain("case \"" + action + "\"");
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("await requireAdmin(ctx, actorId)");
    expect(edge).toContain("await requireSuperadmin(ctx, actorId)");
    expect(edge).toContain('await ctx.supabaseAdmin.rpc("admin_set_user_role"');
    expect(edge).toContain("roleErrorMessages");
    expect(legacy).toContain("Nie można odebrać roli ostatniemu superadministratorowi.");
    expect(legacy).toContain("Najpierw nadaj rolę Administrator.");
    expect(legacy).toContain("Najpierw odbierz rolę Superadministrator.");
  });
});
