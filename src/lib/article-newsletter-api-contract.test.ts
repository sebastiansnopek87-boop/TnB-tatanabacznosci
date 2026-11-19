import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  getArticleNewsletter, prepareArticleNewsletter, saveArticleNewsletter,
  sendArticleNewsletter, sendArticleNewsletterTest, unmarkArticleNewsletter,
} from "./api/article-newsletter";

const articleId = "00000000-0000-4000-8000-000000000002";
const data = {
  articleId, subject: "Nowy artykuł", preheader: "Zapowiedź", intro: "Wprowadzenie",
  teaser: "Treść zajawki", outro: "Zakończenie",
};

beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));

describe("article newsletter SPA contract", () => {
  it("routes all six actions through tnb-article-newsletter with stable payloads", async () => {
    await Promise.all([
      getArticleNewsletter({ data: { articleId } }),
      prepareArticleNewsletter({ data: { articleId, useAi: false } }),
      saveArticleNewsletter({ data }),
      unmarkArticleNewsletter({ data: { articleId } }),
      sendArticleNewsletterTest({ data: { articleId } }),
      sendArticleNewsletter({ data: { articleId, expectedRecipients: 42, confirmed: true } }),
    ]);
    const actions = [
      "getArticleNewsletter", "prepareArticleNewsletter", "saveArticleNewsletter",
      "unmarkArticleNewsletter", "sendArticleNewsletterTest", "sendArticleNewsletter",
    ];
    expect(invoke).toHaveBeenCalledTimes(actions.length);
    for (const action of actions) {
      expect(invoke).toHaveBeenCalledWith("tnb-article-newsletter", {
        body: expect.objectContaining({ action, data: expect.any(Object) }),
      });
    }
    expect(invoke).toHaveBeenCalledWith("tnb-article-newsletter", {
      body: { action: "sendArticleNewsletter", data: { articleId, expectedRecipients: 42, confirmed: true } },
    });
  });

  it("propagates Edge errors instead of treating failed operations as success", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge failed", context: new Response(JSON.stringify({ message: "Wysyłkę newslettera może zatwierdzić wyłącznie superadministrator." }), { status: 403 }) },
    });
    await expect(sendArticleNewsletter({ data: { articleId, expectedRecipients: 42, confirmed: true } }))
      .rejects.toThrow("Wysyłkę newslettera może zatwierdzić wyłącznie superadministrator.");
  });

  it("keeps all Edge actions, role split, recipient confirmation and send safeguards explicit", () => {
    const edge = readFileSync(new URL("../../supabase/functions/tnb-article-newsletter/index.ts", import.meta.url), "utf8");
    const legacy = readFileSync(new URL("./article-newsletter.functions.ts", import.meta.url), "utf8");
    const actions = [
      "getArticleNewsletter", "prepareArticleNewsletter", "saveArticleNewsletter",
      "unmarkArticleNewsletter", "sendArticleNewsletterTest", "sendArticleNewsletter",
    ];
    for (const action of actions) {
      expect(edge).toContain('z.literal("' + action + '")');
      expect(legacy).toContain("export const " + action + " =");
    }
    expect(edge).toContain("requireAdmin(s, req, true)");
    expect(edge).toContain("Wysyłkę newslettera może zatwierdzić wyłącznie superadministrator.");
    expect(edge).toContain("parsed.data.expectedRecipients");
    expect(edge).toContain("list.length !== expected");
    expect(edge).toContain('eq("status", "active")');
    expect(edge).toContain('in("status", [...EDITABLE])');
    expect(edge).toContain("approved_by: actor.id");
    expect(edge).toContain("nl:" + '" + article.id + ":" + round');
    expect(edge).toContain("WYSYŁKA TESTOWA");
    expect(edge).toContain("unsubscribe_token");
  });
});
