import { z } from "zod";

// Invalid or absent identifiers retain the existing list-only default.
export function adminRecordSearch(search: Record<string, unknown>): { record?: string } {
  const parsed = z.string().uuid().safeParse(search["record"]);
  return { record: parsed.success ? parsed.data : undefined };
}