import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: [] as any[], versions: [] as any[], logs: [] as any[], approved: false, auth: vi.fn(), events: vi.fn(), race: false, versionError: false }));
vi.mock("@/config/site-settings", () => ({ getLegalPage: (slug: string) => ({ slug, approved: m.approved }) }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const c: any = { middleware: () => c, inputValidator: (v: any) => { c.v = v; return c; }, handler: (h: any) => (a: any = {}) => h({ ...a, data: c.v ? c.v(a.data) : a.data }) }; return c; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./admin-auth.server", () => ({ assertAdmin: m.auth, logEvent: m.events }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => query(table) } }));
import { LEGAL_KEYS, assertLegalPublication, legalReady } from "./legal-pages";
import { approvalDetail, legalDigest } from "./legal-approval";
import { newSection, pagePath, pageImageNames, reorderItems, SYSTEM_PAGES } from "./pages";
import { homeDraft } from "./home-draft";
import { adminSavePage, adminSetPageStatus, adminPublishDraft, adminSaveDraft, adminListVersions, adminRestoreVersion, getPublicPage } from "./pages.functions";
const id = "11111111-1111-4111-8111-111111111111";
function query(table: string) {
  let selected = [...(table === "site_pages" ? m.rows : table === "admin_events" ? m.logs : m.versions)];
  let patch: any; let insert: any;
  const q: any = { select: () => q, order: () => q, limit: () => q,
    contains: (_k: string, value: any) => { selected = selected.filter(r => r.snapshot?._legal?.digest === value._legal.digest && r.snapshot?._legal?.publishedAt === value._legal.publishedAt); return q; },
    eq: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return q; },
    is: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return q; },
    update: (p: any) => { patch = p; return q; }, insert: (p: any) => { insert = p; return q; },
    single: () => finish(true), maybeSingle: () => finish(true), then: (r: any) => finish(false).then(r) };
  async function finish(single: boolean) {
    if (insert && table === "site_page_versions" && m.versionError) return { data: null, error: { message: "failed" } };
    if (patch && m.race) return { data: null, error: null };
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
beforeEach(() => { m.rows = []; m.versions = []; m.logs = []; m.approved = false; m.race = false; m.versionError = false; m.auth.mockReset(); m.events.mockReset(); m.events.mockImplementation(async (e: any) => { m.logs.push({ id: crypto.randomUUID(), type: e.type, actor: e.actor, object_kind: e.objectKind, object_id: e.objectId, result: e.result ?? "ok", detail: e.detail }); }); });
describe("Legal CMS integration (in-memory data only)", () => {
 it("versions the additive home draft without deleting content, publishing or changing other pages", async () => {
   const d = homeDraft(); const nav = d.sections.find(s => s.kind === "home-nav"); if (!nav) throw new Error("missing nav");
   const oldNav = structuredClone(nav); nav.hidden = true;
   const cinematic = d.sections.find(s => s.kind === "cinematic"); if (!cinematic) throw new Error("missing cinematic");
   cinematic.items[0] = { ...cinematic.items[0], title: "Własna zachowana historia", focalX: 27 };
   const original = { id, system_key: "home", status: "draft", published_at: null, ...draft("home", []) };
   const other = { id: "other", system_key: "o-tnb", status: "published", ...draft("o-tnb") };
   m.rows = [structuredClone(original), structuredClone(other)];
   await call(adminSaveDraft, { id, draft: d, version: true });
   expect(m.rows[0].sections).toEqual(original.sections);
   expect(m.rows[0].status).toBe("draft"); expect(m.rows[0].published_at).toBeNull();
   expect(m.rows[0].draft.sections.map((s: any) => s.kind)).toEqual(["home-nav", "cinematic", "value-strip"]);
   expect(m.rows[0].draft.sections[0]).toEqual({ ...oldNav, hidden: true });
   expect(m.rows[0].draft.sections[1].items[0]).toMatchObject({ title: "Własna zachowana historia", focalX: 27 });
   expect(m.rows[1]).toEqual(other); expect(m.versions[0].snapshot).toEqual(d);
   expect(await call(getPublicPage, { key: "home" })).toBeNull();
 });
 it("home persists individual scene settings through draft, publish, public read and restore", async () => {
   const d = homeDraft(); d.sections = d.sections.map(s => ({ ...s, optional: false })); const scene = d.sections[1]; if (!scene) throw new Error("missing scene");
   scene.items[0] = { ...scene.items[0], title: "Indywidualna scena", body: "Indywidualny opis", image: "img-scene.jpg", imageAlt: "Opis testowy", href: "/artykuly", hidden: true, focalX: 27, focalY: 63, align: "right" };
   await call(adminSavePage, { ...d, sections: [], id: null, system_key: "home" });
   expect(await call(getPublicPage, { key: "home" })).toBeNull();
   await call(adminSaveDraft, { id, draft: d, version: true });
   expect(m.rows[0].draft).toEqual(d); expect(m.rows[0].status).toBe("draft");
   await call(adminPublishDraft, { id });
   expect((await call(getPublicPage, { key: "home" })).sections).toEqual(d.sections);
   const live = JSON.stringify(m.rows[0].sections);
   await call(adminRestoreVersion, { id, versionId: id });
   expect(m.rows[0].draft).toEqual(d); expect(JSON.stringify(m.rows[0].sections)).toBe(live);
   expect(pagePath({ slug: "home", system_key: "home" })).toBe("/");
 });
 it("rejects unsafe scene links and out-of-range cropping", async () => {
   m.rows = [{ id, system_key: "home", status: "draft", ...homeDraft() }];
   const d = homeDraft(); const s = d.sections[1]; if (!s) throw new Error("missing");
   s.items[0] = { title: "test", body: "test", href: "javascript:alert(1)", focalX: 101 };
   expect(() => call(adminSaveDraft, { id, draft: d })).toThrow();
 });
 it("item reordering keeps formatting and independent copies with the correct scene", () => {
   const s = { ...newSection("cinematic"), items: [{ title: "A", body: "a", image: "a.jpg" }, { title: "B", body: "b", image: "b.jpg" }], textFormats: { "item-0-title": { doc: { type: "doc", content: [] }, width: 65 } } };
   const moved = reorderItems(s,[1,0,0]);
   expect(moved.items?.map(x => x.title)).toEqual(["B","A","A"]);
   expect(moved.textFormats?.["item-1-title"]?.width).toBe(65);
   if (moved.items?.[1]) moved.items[1].title = "Changed";
   expect(s.items[0]?.title).toBe("A"); expect(moved.items?.[2]?.title).toBe("A");
   expect(pageImageNames([s])).toEqual(["a.jpg","b.jpg"]);
 });
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
     expect(legalReady("regulamin", { system_key: "regulamin", status: "published", legal_approved: true, sections: s })).toBe(false);
     expect(() => assertLegalPublication("regulamin", s)).toThrow("uzupełnienia");
   }
   expect(legalReady("regulamin", { system_key: "regulamin", status: "published", legal_approved: true, sections: sections() })).toBe(true);
 });
 it.each(LEGAL_KEYS)("does not infer approval from content for %s", key => {
   expect(legalReady(key, { system_key: key, status: "published", sections: sections() })).toBe(false);
   expect(() => assertLegalPublication(key, sections())).toThrow("zatwierdzenia");
 });
 it("creates an independent legal draft with fixed system key", async () => {
   const result = await call(adminSavePage, { id: null, system_key: "regulamin", ...draft("regulamin", []) });
   expect(result.id).toBe(id); expect(m.rows[0]).toMatchObject({ system_key: "regulamin", slug: "regulamin", status: "draft", sections: [] });
   expect(await call(getPublicPage, { key: "regulamin" })).toBeNull();
 });
 it("blocks status publish, builder publish and live form edits without approval", async () => {
   m.rows = [{ id, system_key: "regulamin", status: "draft", ...draft("regulamin") }];
   await expect(call(adminSetPageStatus, { id, status: "published" })).rejects.toThrow("zatwierdzenia");
   await expect(call(adminPublishDraft, { id })).rejects.toThrow("zatwierdzenia");
   m.rows[0].status = "published";
   await expect(call(adminSavePage, { id, ...draft("regulamin") })).rejects.toThrow("zatwierdzenia");
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
describe("Explicit exact-version approval (no real documents)", () => {
 const setup = () => { const d = draft("regulamin"); m.rows = [{ id, system_key: "regulamin", status: "draft", updated_at: "2026-10-19T10:00:00Z", ...d }]; return d; };
 const approve = async (d: ReturnType<typeof draft>) => call(adminPublishDraft, { id, legalConfirmed: true, expectedDigest: await legalDigest(d) });
 it("approves the exact version and records document, actor and version", async () => {
   const d = setup(); await approve(d);
   const v = m.versions[0];
   expect(v).toMatchObject({ page_id: id, created_by: id, kind: "publish" });
   expect(m.logs[0]).toMatchObject({ type: "legal_document_approved", actor: id, object_id: id, detail: approvalDetail(v.id, await legalDigest(d)) });
   expect(legalReady("regulamin", await call(getPublicPage, { key: "regulamin" }))).toBe(true);
 });
 it.each([false, undefined])("rejects confirmation %s", async legalConfirmed => {
   const d = setup(); await expect(call(adminPublishDraft, { id, legalConfirmed, expectedDigest: await legalDigest(d) })).rejects.toThrow("zatwierdzenia"); expect(m.versions).toHaveLength(0);
 });
 it("rejects empty and invalid content", async () => {
   setup(); m.rows[0].sections = []; await expect(approve(draft("regulamin", []))).rejects.toThrow("uzupełnienia");
   m.rows[0].sections = [{ kind: "invalid" }]; await expect(call(adminPublishDraft, { id, legalConfirmed: true })).rejects.toThrow(); expect(m.logs).toHaveLength(0);
 });
 it("rejects users without admin rights before approval or publication", async () => {
   const d = setup(); m.auth.mockRejectedValue(new Error("Brak uprawnień")); await expect(approve(d)).rejects.toThrow("uprawnień"); expect(m.logs).toHaveLength(0); expect(m.rows[0].status).toBe("draft");
 });
 it("rejects a changed draft with an old confirmation digest", async () => {
   const d = setup(); m.rows[0].draft = { ...d, intro: "Zmieniona treść" }; await expect(approve(d)).rejects.toThrow("Treść zmieniła"); expect(m.versions).toHaveLength(0);
 });
 it("invalidates public approval after content mutation and without an event", async () => {
   const d = setup(); await approve(d); m.rows[0].intro = "Inna wersja"; expect((await call(getPublicPage, { key: "regulamin" })).legal_approved).toBe(false);
   m.rows[0].intro = d.intro; m.logs = []; expect((await call(getPublicPage, { key: "regulamin" })).legal_approved).toBe(false);
 });
 it("fails closed when the audit log is unavailable", async () => {
   const d = setup(); m.events.mockResolvedValue(undefined); await expect(approve(d)).rejects.toThrow("dzienniku"); expect(m.rows[0].status).toBe("draft");
 });
 it("fails closed when the version cannot be stored", async () => {
   const d = setup(); m.versionError = true; await expect(approve(d)).rejects.toThrow("wersji"); expect(m.rows[0].status).toBe("draft"); expect(m.logs).toHaveLength(0);
 });
 it("rejects a concurrent page update without publishing", async () => {
   const d = setup(); m.race = true; await expect(approve(d)).rejects.toThrow("podczas publikacji"); expect(m.rows[0].status).toBe("draft");
 });
 it("saving/reopening/restoring drafts does not transfer approval", async () => {
   const d = setup(); await approve(d); const v = m.versions[0];
   const edited = { ...d, intro: "Nowszy szkic" }; await call(adminSaveDraft, { id, draft: edited, version: true });
   expect(m.rows[0].draft.intro).toBe("Nowszy szkic"); expect((await call(getPublicPage, { key: "regulamin" })).legal_approved).toBe(true);
   await expect(call(adminPublishDraft, { id })).rejects.toThrow("zatwierdzenia");
   await call(adminRestoreVersion, { id, versionId: v.id }); await expect(call(adminPublishDraft, { id })).rejects.toThrow("zatwierdzenia");
 });
 it("draft and unapproved published content never become ready", () => {
   const p = { system_key: "regulamin", sections: sections(), status: "draft", legal_approved: true }; expect(legalReady("regulamin", p)).toBe(false); expect(legalReady("regulamin", { ...p, status: "published", legal_approved: false })).toBe(false);
 });
 it("digest ignores object key order but detects formatting edits", async () => {
   const d = setup(); expect(await legalDigest({ ...d, sections: d.sections.map(s => Object.fromEntries(Object.entries(s).reverse()) as typeof s) })).toBe(await legalDigest(d));
   expect(await legalDigest({ ...d, sections: d.sections.map(s => ({ ...s, heading: "Nowy" })) })).not.toBe(await legalDigest(d));
 });
});
