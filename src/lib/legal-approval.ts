import { normalizeSections, type PageDraft } from "./pages";

// Stable across JSONB key ordering; approval covers all public editable fields.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function legalSnapshot(page: PageDraft): PageDraft {
  return { slug: page.slug, title: page.title, intro: page.intro, sections: normalizeSections(page.sections).map(s => ({ ...s, hidden: s.hidden ?? false, optional: s.optional ?? false })), seo_title: page.seo_title, seo_description: page.seo_description };
}
export async function legalDigest(page: PageDraft): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(legalSnapshot(page))));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export const approvalDetail = (versionId: string, digest: string) => `legal-v1:${versionId}:${digest}`;