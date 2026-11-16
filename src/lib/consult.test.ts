import { describe, expect, it } from "vitest";
import {
  addDays,
  canUserCancel,
  isoWeekday,
  warsawHm,
  warsawToUtc,
  warsawYmd,
} from "./consult";

describe("consultation calendar helpers", () => {
  it("converts Warsaw winter time to UTC", () => {
    expect(warsawToUtc("2026-01-15", "10:30").toISOString()).toBe("2026-01-15T09:30:00.000Z");
  });

  it("converts Warsaw summer time to UTC", () => {
    expect(warsawToUtc("2026-07-15", "10:30").toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });

  it("uses the correct offsets on both sides of the spring DST transition", () => {
    expect(warsawToUtc("2026-03-29", "01:30").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(warsawToUtc("2026-03-29", "03:30").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("round-trips a valid Warsaw wall-clock time", () => {
    const utc = warsawToUtc("2026-10-20", "14:45");
    expect(warsawYmd(utc)).toBe("2026-10-20");
    expect(warsawHm(utc)).toBe("14:45");
  });

  it("calculates ISO weekdays and date arithmetic across month and leap-year boundaries", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("enforces the exact two-hour cancellation cutoff", () => {
    const now = Date.parse("2026-11-16T10:00:00.000Z");
    expect(canUserCancel("2026-11-16T12:00:00.000Z", now)).toBe(true);
    expect(canUserCancel("2026-11-16T11:59:59.999Z", now)).toBe(false);
    expect(canUserCancel("2026-11-16T11:00:00.000Z", now)).toBe(false);
  });
});
