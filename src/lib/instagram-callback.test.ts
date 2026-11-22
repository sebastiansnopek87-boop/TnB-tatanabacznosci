import { describe, expect, it } from "vitest";
import { readInstagramOAuthCallback } from "./instagram-callback";

describe("Instagram OAuth callback", () => {
  it("accepts a valid one-time state and authorization code", () => {
    expect(readInstagramOAuthCallback(new URLSearchParams({
      state: "12345678901234567890-state",
      code: "authorization-code",
    }))).toEqual({
      status: "ready",
      state: "12345678901234567890-state",
      code: "authorization-code",
    });
  });

  it("treats a provider cancellation as cancellation", () => {
    expect(readInstagramOAuthCallback(new URLSearchParams({ error: "access_denied" })))
      .toEqual({ status: "cancelled" });
  });

  it("fails closed when state or code is missing or outside the accepted bounds", () => {
    expect(readInstagramOAuthCallback(new URLSearchParams({ code: "x" }))).toEqual({ status: "invalid" });
    expect(readInstagramOAuthCallback(new URLSearchParams({ state: "short", code: "x" }))).toEqual({ status: "invalid" });
    expect(readInstagramOAuthCallback(new URLSearchParams({
      state: "12345678901234567890-state",
      code: "x".repeat(2001),
    }))).toEqual({ status: "invalid" });
  });
});
