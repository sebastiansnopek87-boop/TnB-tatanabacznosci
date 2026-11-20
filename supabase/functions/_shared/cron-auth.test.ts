import { assertEquals } from "jsr:@std/assert";
import { parseBearerToken } from "./cron-auth.ts";

Deno.test("accepts bearer tokens containing the letter s", () => {
  assertEquals(parseBearerToken("Bearer abc123sxyz"), "abc123sxyz");
});

Deno.test("rejects missing, empty, or whitespace-containing bearer tokens", () => {
  assertEquals(parseBearerToken(null), null);
  assertEquals(parseBearerToken(""), null);
  assertEquals(parseBearerToken("Bearer "), null);
  assertEquals(parseBearerToken("Bearer token with spaces"), null);
});

Deno.test("accepts case-insensitive bearer scheme", () => {
  assertEquals(parseBearerToken("bearer token-123"), "token-123");
});
