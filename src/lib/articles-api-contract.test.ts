import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getSession, getUser, rpc, from, maybeSingle } = vi.hoisted(() => ({
  invoke: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(),
}));
const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle,
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession, getUser },
    functions: { invoke },
    rpc,
    from,
  },
}));

import {
  adminArticleInteractions, adminCheckArticleSlug, adminCreateArticleUpload, adminDeleteCategory,
  adminDeletePoll, adminGetArticle, adminListArticleComments, adminListArticles, adminModerateArticleComment,
  adminSaveArticle, adminSaveCategory, adminSavePoll, adminSetFeatured, adminSetHomeMode,
  adminSetArticleStatus, adminTrashArticle,
} from "./api/articles";

const id = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: { id }, error: null });
  from.mockReset().mockReturnValue(query);
  query.select.mockClear(); query.eq.mockClear();
});

describe("articles SPA contract", () => {
  it("routes all fifteen Edge actions through tnb-articles with the current bearer token", async () => {
    await Promise.all([
      adminListArticles(),
      adminTrashArticle({ data: { id, action: "trash" } }),
      adminSaveArticle({ data: { id, title: "Artykuł" } }),
      adminSetArticleStatus({ data: { id, status: "published" } }),
      adminSetFeatured({ data: { id, featured: true, home_order: 1 } }),
      adminSetHomeMode({ data: { mode: "featured" } }),
      adminSaveCategory({ data: { original: null, slug: "test", name: "Test", sort_order: 1 } }),
      adminDeleteCategory({ data: { slug: "test" } }),
      adminCreateArticleUpload({ data: { id, type: "image/jpeg", size: 1024 } }),
      adminArticleInteractions({ data: { id } }),
      adminDeletePoll({ data: { id } }),
      adminListArticleComments({ data: { filter: "reported" } }),
      adminModerateArticleComment({ data: { id, action: "hide" } }),
    ]);
    const actions = [
      "adminListArticles", "adminTrashArticle", "adminSaveArticle", "adminSetArticleStatus",
      "adminSetFeatured", "adminSetHomeMode", "adminSaveCategory", "adminDeleteCategory",
      "adminCreateArticleUpload", "adminArticleImageUrls", "adminArticleInteractions",
      "adminSavePoll", "adminDeletePoll", "adminListArticleComments", "adminModerateArticleComment",
    ];
    expect(invoke).toHaveBeenCalledTimes(13);
    for (const action of actions) {
      if (action === "adminArticleImageUrls" || action === "adminSavePoll") continue;
      expect(invoke).toHaveBeenCalledWith("tnb-articles", {
        body: expect.objectContaining({ action }),
        headers: { Authorization: "Bearer admin-token" },
      });
    }
  });

  it("keeps direct article reads behind an authenticated admin check and client RLS", async () => {
    await adminGetArticle({ data: { id } });
    expect(getUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: id, _role: "admin" });
    expect(from).toHaveBeenCalledWith("articles");
    expect(query.select).toHaveBeenCalledWith("*");
    await adminCheckArticleSlug({ data: { slug: "artykul-testowy", id } });
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("slug", "artykul-testowy");
  });

  it("rejects direct admin reads without an authenticated admin", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(adminGetArticle({ data: { id } })).rejects.toThrow("Sesja wygasła");
    getUser.mockResolvedValueOnce({ data: { user: { id } }, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(adminCheckArticleSlug({ data: { slug: "artykul-testowy", id } })).rejects.toThrow("Brak uprawnień administratora.");
  });

  it("keeps Edge actions, admin gate, validation and destructive-operation controls explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-articles/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./articles.functions.ts", import.meta.url), "utf8");
    const actions = [
      "adminListArticles", "adminTrashArticle", "adminGetArticle", "adminCheckArticleSlug",
      "adminSaveArticle", "adminSetArticleStatus", "adminSetFeatured", "adminSetHomeMode",
      "adminSaveCategory", "adminDeleteCategory", "adminCreateArticleUpload", "adminArticleImageUrls",
      "adminArticleInteractions", "adminSavePoll", "adminDeletePoll", "adminListArticleComments",
      "adminModerateArticleComment",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(edge).toContain('case "' + action + '":');
    }
    for (const action of actions.filter((name) => name !== "adminGetArticle" && name !== "adminCheckArticleSlug")) {
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("await requireAdmin(ctx)");
    expect(edge).toContain('z.enum(["trash", "restore", "purge"])');
    expect(edge).toContain("purgeArticle");
    expect(edge).toContain("adminModerateArticleComment");
  });
});
