import { describe, expect, it } from "vitest";
import { adminRecordSearch } from "./admin-record-search";
import { historyPage, materialSearchFilter, searchParts, type HistoryEvent } from "./control-center";

const id = "11111111-1111-4111-8111-111111111111";
const before = "2026-10-18T18:00:00.000Z";

describe("Control Center 360 pure helpers", () => {
  it("accepts only one valid record UUID", () => {
    expect(adminRecordSearch({ record: id })).toEqual({ record: id });
    for (const value of [undefined, "", "invalid", [id], 42]) expect(adminRecordSearch({ record: value })).toEqual({ record: undefined });
  });
  it("builds safe exact-slug and partial-title search filters", () => {
    expect(materialSearchFilter("test-zakupu-etap-21")).toBe('slug.eq."test-zakupu-etap-21",title.ilike."%test-zakupu-etap-21%"');
    const safe = searchParts("a,b(\"c\")").safe;
    expect(safe).toBe("a b c");
    expect(materialSearchFilter(safe)).toBe('slug.eq."a b c",title.ilike."%a b c%"');
  });
  it("deduplicates by source and ID, sorts, and advances independent cursors", () => {
    const make = (source: HistoryEvent["source"], at: string): HistoryEvent => ({ id: "same", source, at, type: "paid", actor: null, objectKind: "order", objectId: id, detail: null, result: null });
    const mail = make("mail", "2026-10-17T00:00:00.000Z");
    const page = historyPage([make("order", before)], [make("admin", before)], { order: 0, admin: 0, mail: 0 }, [mail, mail]);
    expect(page.rows.map((row) => row.source)).toEqual(["admin", "order", "mail"]);
    expect(page.next).toEqual({ order: 1, admin: 1, mail: 1 });
  });
});
