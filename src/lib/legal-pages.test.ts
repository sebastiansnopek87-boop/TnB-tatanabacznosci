import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: [] as any[], versions: [] as any[], approved: false, auth: vi.fn(), events: vi.fn() }));
vi.mock("@/config/site-settings", () => ({ getLegalPage: (slug: string) => ({ slug, approved: m.approved }) }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const c: any = { middleware: () => c, inputValidator: (v: any) => { c.v = v; return c; }, handler: (h: any) => (a: any = {}) => h({ ...a, data: c.v ? c.v(a.data) : a.data }) }; return c; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./admin-auth.server", () => ({ assertAdmin: m.auth, logEvent: m.events }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => query(table) } }));
import { LEGAL_KEYS, assertLegalPublication, legalReady } from "./legal-pages";
import { newSection, pagePath, SYSTEM_PAGES } from "./pages";
import { adminSavePage, adminSetPageStatus, adminPublishDraft, adminSaveDraft, adminListVersions, adminRestoreVersion, getPublicPage } from "./pages.functions";
const id = "11111111-1111-4111-8111-111111111111";
function query(table: string) {
  let selected = [...(table === "site_pages" ? m.rows : m.versions)];
  let patch: any; let insert: any;
  const q: any = { select: () => q, order: () => q, limit: () => q,
    eq: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return q; },
    is: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return q; },
    update: (p: any) => { patch = p; return q; }, insert: (p: any) => { insert = p; return q; },
    single: () => finish(true), maybeSingle: () => finish(true), then: (r: any) => finish(false).then(r) };
  async function finish(single: boolean) {
    if (patch) selected.forEach(row => Object.assign(row, patch));
    if (insert) { const row = { id, status: "draft", ...insert }; (table === "site_pages" ? m.rows : m.versions).push(row); selected = [row]; }
    return { data: single ? selected[0] ?? null : selected, error: null, count: selected.length };
  }
  return q;
}
const ctx = () => ({ userId: id, supabase: { from: query } });
const sections = () => [{ ...newSection("text"), optional: false, body: "Treść testowa w pamięci testu" }];
const draft = (key: string, s = sections()) => ({ slug: key, title: SYSTEM_PAGES[key]?.label ?? key, intro: "", sections: s, seo_title: "", seo_description: "" });
const call = (fn: any, data: any) => fn({ data, context: ctx() });
beforeEach(() => { m.rows = []; m.versions = []; m.approved = false; m.auth.mockReset(); m.events.mockReset(); });
describe("Legal CMS integration (in-memory data only)", () => {
 it.each(LEGAL_KEYS)("maps and reads only the published system document %s", async key => {
   expect(pagePath({ slug: "other", system_key: key })).toBe(`/${key}`);
   m.rows = LEGAL_KEYS.map(k => ({ id: k, system_key: k, status: "published", ...draft(k) }));
   expect((await call(getPublicPage, { key })).system_key).toBe(key);
 });
 it.each(LEGAL_KEYS)("returns null for missing/draft/archived %s", async key => {
   expect(await call(getPublicPage, { key })).toBeNull();
   for (const status of ["draft", "archived"]) { m.rows = [{ system_key: key, status }]; expect(await call(getPublicPage, { key })).toBeNull(); }
 });
 it("requires visible substantive content even when approved", () => {
   m.approved = true;
   for (const s of [[], [{ ...newSection(), heading: "Nagłówek" }], [{ ...newSection(), body: "Ukryta treść", hidden: true }]]) {
     expect(legalReady("regulamin", s)).toBe(false);
     expect(() => assertLegalPublication("regulamin", s)).toThrow("uzupełnienia");
   }
   expect(legalReady("regulamin", sections())).toBe(true);
 });
 it.each(LEGAL_KEYS)("does not infer approval from content for %s", key => {
   expect(legalReady(key, sections())).toBe(false);
   expect(() => assertLegalPublication(key, sections())).toThrow("zatwierdzony");
 });
 it("creates an independent legal draft with fixed system key", async () => {
   const result = await call(adminSavePage, { id: null, system_key: "regulamin", ...draft("regulamin", []) });
   expect(result.id).toBe(id); expect(m.rows[0]).toMatchObject({ system_key: "regulamin", slug: "regulamin", status: "draft", sections: [] });
   expect(await call(getPublicPage, { key: "regulamin" })).toBeNull();
 });
 it("blocks status publish, builder publish and live form edits without approval", async () => {
   m.rows = [{ id, system_key: "regulamin", status: "draft", ...draft("regulamin") }];
   await expect(call(adminSetPageStatus, { id, status: "published" })).rejects.toThrow("zatwierdzony");
   await expect(call(adminPublishDraft, { id })).rejects.toThrow("zatwierdzony");
   m.rows[0].status = "published";
   await expect(call(adminSavePage, { id, ...draft("regulamin") })).rejects.toThrow("zatwierdzony");
   expect(m.versions).toEqual([]);
 });
 it("saves/versions/restores one document without altering the others or publishing", async () => {
   m.rows = LEGAL_KEYS.map((key, n) => ({ id: n === 0 ? id : key, system_key: key, status: "draft", ...draft(key, []) }));
   const others = JSON.stringify(m.rows.slice(1)); const d = draft("regulamin");
   await call(adminSaveDraft, { id, draft: d, version: true });
   expect(m.rows[0].draft).toEqual(d); expect(m.rows[0].sections).toEqual([]); expect(m.rows[0].status).toBe("draft");
   expect((await call(adminListVersions, { id }))[0].snapshot).toEqual(d);
   await call(adminRestoreVersion, { id, versionId: id });
   expect(m.rows[0].draft).toEqual(d); expect(JSON.stringify(m.rows.slice(1))).toBe(others);
 });
 it.each(["o-tnb", "moja-historia"])("preserves reads and publication for %s", async key => {
   m.rows = [{ id, system_key: key, status: "draft", ...draft(key, []) }];
   await call(adminPublishDraft, { id });
   expect((await call(getPublicPage, { key })).system_key).toBe(key);
   expect(pagePath({ slug: key, system_key: key })).toBe(`/${key}`);
 });
});
