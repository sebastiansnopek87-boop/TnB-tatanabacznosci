// Free Biblioteka materials delivered via a short form: "form_download" (link shown at once)
// or "email" (link sent through the central notification engine). One register:
// library_requests (server-only writes, admin-only reads). Only SHA-256 of tokens is stored.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-auth.server";
import { FREE_CONSENT_TEXT, PRIVACY_VERSION } from "./library";

const BUCKET = "library-files";
const TTL_H = { form_download: 24, email: 72 } as const;
const name = (msg: string) => z.string().trim().min(1, msg).max(60).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Pole zawiera niedozwolone znaki.");

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const requestFreeMaterial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().max(120),
    firstName: name("Podaj imię."),
    lastName: name("Podaj nazwisko.").max(80),
    email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    consent: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj informację o przetwarzaniu danych." }) }),
    website: z.string().max(0).optional().default(""),
    elapsedMs: z.number().int().nonnegative(),
  }).parse(d))
  .handler(async ({ data }): Promise<{ mode: "form_download"; token: string } | { mode: "email" }> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: item } = await db.from("library_items").select("id, title, summary, access, status, free_delivery").eq("slug", data.slug).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "public" || item.free_delivery === "direct") throw new Error("Ten materiał nie jest dostępny przez formularz.");
    const mode = item.free_delivery as "form_download" | "email";
    // Bots get the same neutral answer as a real e-mail request; form mode just gets no file.
    if (data.website || data.elapsedMs < 2500) { if (mode === "email") return { mode }; throw new Error("Spróbuj ponownie za chwilę."); }
    const { data: c } = await db.from("library_item_content").select("file_path").eq("item_id", item.id).maybeSingle();
    if (!c?.file_path) throw new Error("Materiał jest chwilowo niedostępny.");

    const { hashIp } = await import("./notifications.server");
    const ipHash = await hashIp(getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim());
    const since = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    if (ipHash) {
      const { count } = await db.from("library_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(60));
      if ((count ?? 0) >= 10) throw new Error("Wysłano zbyt wiele zgłoszeń. Spróbuj ponownie później.");
    }
    // Repeated submit (double click, refresh): reuse the recent request instead of creating/sending again.
    const { data: recent } = await db.from("library_requests").select("id").eq("item_id", item.id).eq("email", data.email).eq("mode", mode).gte("created_at", since(10)).limit(1).maybeSingle();
    const token = newToken();
    const expires = new Date(Date.now() + TTL_H[mode] * 3600_000).toISOString();
    if (recent) {
      if (mode === "email") return { mode };
      await db.from("library_requests").update({ token_hash: await sha256(token), token_expires_at: expires, updated_at: new Date().toISOString() } as never).eq("id", recent.id);
      return { mode, token };
    }
    const now = new Date().toISOString();
    const { data: row, error } = await db.from("library_requests").insert({
      item_id: item.id, item_title: item.title, mode, status: mode === "email" ? "pending_send" : "download_ready",
      first_name: data.firstName, last_name: data.lastName, email: data.email,
      consent_text: FREE_CONSENT_TEXT, privacy_version: PRIVACY_VERSION, consent_at: now,
      token_hash: await sha256(token), token_expires_at: expires, ip_hash: ipHash,
    } as never).select("id").single();
    if (error || !row) throw new Error("Nie udało się przyjąć zgłoszenia. Spróbuj ponownie.");
    if (mode === "form_download") return { mode, token };

    const { siteOrigin } = await import("./orders.server");
    const { dispatch } = await import("./notifications.server");
    const r = await dispatch({
      event: "library_free_material", to: data.email, relatedId: row.id, idempotencyKey: `library-free-${row.id}`,
      vars: { imie: data.firstName, tytul_materialu: item.title, opis_materialu: item.summary || item.title, waznosc_linku: `${TTL_H.email} godziny`,
        link_do_materialu: `${siteOrigin()}/biblioteka/pobierz?t=${token}` },
    });
    // "sent" only when the engine really delivered; simulated/skipped/failed are recorded as such.
    const status = r.status === "sent" ? "sent" : r.status === "simulated" ? "simulated" : r.status === "duplicate" ? "pending_send" : "send_failed";
    await db.from("library_requests").update({ status, notification_log_id: r.id ?? null, notification_status: r.status + (r.reason ? `:${r.reason}` : ""), updated_at: new Date().toISOString() } as never).eq("id", row.id);
    return { mode };
  });

export const redeemFreeMaterial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }): Promise<{ status: "ok"; url: string; title: string } | { status: "invalid" | "expired" | "unavailable" }> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: r } = await db.from("library_requests").select("id, item_id, token_expires_at, download_count, status").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!r || r.status === "cancelled") return { status: "invalid" };
    if (!r.token_expires_at || new Date(r.token_expires_at) < new Date()) {
      if (r.status !== "downloaded") await db.from("library_requests").update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", r.id);
      return { status: "expired" };
    }
    // Token is bound to one item: the file is looked up from the request, never from user input.
    const { data: item } = await db.from("library_items").select("title, status, access").eq("id", r.item_id).maybeSingle();
    const { data: c } = await db.from("library_item_content").select("file_path, file_name").eq("item_id", r.item_id).maybeSingle();
    if (!item || item.status !== "published" || item.access !== "public" || !c?.file_path) return { status: "unavailable" };
    const { data: s, error } = await db.storage.from(BUCKET).createSignedUrl(c.file_path, 300, { download: c.file_name ?? "material.pdf" });
    if (error || !s) return { status: "unavailable" };
    const now = new Date().toISOString();
    await db.from("library_requests").update({ status: "downloaded", downloaded_at: now, download_count: r.download_count + 1, updated_at: now } as never).eq("id", r.id);
    return { status: "ok", url: s.signedUrl, title: item.title };
  });

export const adminListLibraryRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    itemId: z.string().uuid().nullable().default(null),
    email: z.string().trim().max(100).default(""),
    mode: z.enum(["direct", "form_download", "email"]).nullable().default(null),
    status: z.string().max(20).nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Retention: personal data is kept 12 months, then removed on the next history view.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("library_requests").delete().lt("retention_until", new Date().toISOString());
    let q = context.supabase.from("library_requests")
      .select("id, item_id, item_title, mode, status, user_id, first_name, last_name, email, consent_text, privacy_version, consent_at, token_expires_at, downloaded_at, download_count, notification_status, retention_until, created_at, updated_at")
      .order("created_at", { ascending: false }).limit(300);
    if (data.itemId) q = q.eq("item_id", data.itemId);
    if (data.mode) q = q.eq("mode", data.mode);
    if (data.status) q = q.eq("status", data.status);
    const e = data.email.replace(/[%,()*\\]/g, "");
    if (e.length >= 2) q = q.ilike("email", `%${e}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać historii.");
    return rows ?? [];
  });

export const adminEraseLibraryRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logEvent } = await import("./admin-auth.server");
    const { error } = await supabaseAdmin.from("library_requests").update({ first_name: null, last_name: null, email: null, ip_hash: null, token_hash: null, status: "cancelled", updated_at: new Date().toISOString() } as never).eq("id", data.id);
    await logEvent({ type: "library_request_erased", actor: context.userId, objectKind: "library_request", objectId: data.id, result: error ? "failed" : "ok" });
    if (error) throw new Error("Nie udało się usunąć danych.");
    return { ok: true };
  });
