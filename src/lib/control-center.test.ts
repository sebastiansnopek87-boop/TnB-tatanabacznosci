import { describe, expect, it } from "vitest";
import { accountMatches, accessPresentation, readState, searchParts, requestNameFilter, historyPage, HISTORY_SIZE, type HistoryEvent } from "./control-center";

describe("Control Center presentation helpers", () => {
  it("distinguishes email candidates from identifier ownership", () => {
    expect(accountMatches(null, "JAN@example.com", [{ id: "a", email: "jan@example.com" }, { id: "b", email: "other@example.com" }])).toEqual([{ userId: "a", kind: "email" }]);
    expect(accountMatches("a", "jan@example.com", [{ id: "a", email: "jan@example.com" }])).toEqual([{ userId: "a", kind: "user_id" }]);
  });
  it("does not turn an expired display date into an authorization decision", () => {
    expect(accessPresentation(true, "2026-01-01", Date.parse("2026-10-18"))).toMatchObject({ allowed: true, expired: true });
    expect(accessPresentation(false, null).allowed).toBe(false);
  });
  it("distinguishes read errors from empty and limited results", () => {
    expect(readState(new Error("private"), 0, 100).error).toBeTruthy();
    expect(readState(null, 0, 100)).toEqual({ error: null, limited: false, incomplete: false });
    expect(readState(null, 101, 100).limited).toBe(true);
    expect(readState(null, 100, 100).limited).toBe(false);
    expect(readState(null, 0, 100, true).incomplete).toBe(true);
  });
  it("matches names across separate columns and preserves safe slugs", () => {
    expect(requestNameFilter(searchParts("Jan Nowak").words)).toBe('and(first_name.ilike."%Jan%",last_name.ilike."%Nowak%")');
    expect(requestNameFilter(["Jan"])).toBeNull();
    expect(searchParts("test-zakupu-etap-21").safe).toBe("test-zakupu-etap-21");
    expect(searchParts("wole-siedziec-gdy-sikam").safe).toBe("wole-siedziec-gdy-sikam");
  });
  it("pages chronology without dropping two aspects of the same operation", () => {
    const make = (source: "order" | "admin", n: number): HistoryEvent => ({ id: String(n), at: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(), source, type: "paid", actor: null, objectKind: "order", objectId: "a", detail: null, result: null });
    const order = Array.from({ length: 31 }, (_, n) => make("order", 31 - n));
    const admin = [make("admin", 31)];
    const page = historyPage(order, admin, { order: 0, admin: 0 });
    expect(page.rows).toHaveLength(HISTORY_SIZE);
    expect(page.rows.filter((r) => r.at === order[0]?.at)).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.next).toEqual({ order: 29, admin: 1, mail: 0 });
  });
});
