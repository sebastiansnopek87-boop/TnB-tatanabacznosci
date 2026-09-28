import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

// Server-side role check — every admin function calls this before touching data.
// RLS (has_role) enforces the same rule in the database as a second layer.
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Brak uprawnień administratora.");
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data, email: (context.claims as { email?: string }).email ?? null };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const c = async (q: any) => (await q).count ?? 0;
    const [newMsgs, allMsgs, active, pending, unsub, failed] = await Promise.all([
      c(db.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
      c(db.from("contact_messages").select("id", { count: "exact", head: true }).neq("status", "archived")),
      c(db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active")),
      c(db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "pending")),
      c(db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "unsubscribed")),
      c(db.from("email_notification_log").select("id", { count: "exact", head: true }).eq("status", "failed")),
    ]);
    return { newMsgs, allMsgs, active, pending, unsub, failed };
  });

const msgFilter = z.object({
  status: z.enum(["all", "new", "read", "archived", "inbox"]).default("inbox"),
  q: z.string().trim().max(200).default(""),
  sort: z.enum(["desc", "asc"]).default("desc"),
});

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => msgFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("contact_messages").select("*").order("created_at", { ascending: data.sort === "asc" }).limit(500);
    if (data.status === "inbox") q = q.neq("status", "archived");
    else if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q) {
      const s = data.q.replace(/[%,()]/g, " ");
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,subject.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać wiadomości.");
    return rows as Array<{ id: string; name: string; email: string; subject: string; message: string; status: string; created_at: string; read_at: string | null; archived_at: string | null }>;
  });

export const setMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "read", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const now = new Date().toISOString();
    const patch: { status: string; read_at?: string | null; archived_at?: string | null } =
      data.status === "new" ? { status: "new", read_at: null, archived_at: null }
      : data.status === "read" ? { status: "read", read_at: now, archived_at: null }
      : { status: "archived", archived_at: now };
    const { error, count } = await context.supabase.from("contact_messages").update(patch, { count: "exact" }).eq("id", data.id);
    if (error || !count) throw new Error("Nie udało się zmienić statusu wiadomości.");
    return { ok: true as const };
  });

const subFilter = z.object({
  status: z.enum(["all", "pending", "active", "unsubscribed"]).default("all"),
  q: z.string().trim().max(200).default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
});

export const listSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Tokens and IP hash are deliberately not selected.
    let q = context.supabase.from("newsletter_subscribers")
      .select("id,email,status,source,consent_text,consent_version,consent_given_at,opt_in_method,confirmed_at,unsubscribed_at,subscribe_count,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(5000);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q) q = q.ilike("email", `%${data.q.replace(/[%,]/g, "")}%`);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999Z`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać subskrybentów.");
    return rows as Array<{ id: string; email: string; status: string; source: string; consent_text: string; consent_version: string; consent_given_at: string; opt_in_method: string; confirmed_at: string | null; unsubscribed_at: string | null; subscribe_count: number; created_at: string; updated_at: string }>;
  });

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) throw new Error("Nie udało się pobrać ustawień e-mail.");
    return data as { notification_recipient: string | null; sender_name: string; sender_local_part: string; sender_domain: string | null; admin_inbox_url: string | null; contact_notifications_enabled: boolean; newsletter_notifications_enabled: boolean; newsletter_double_opt_in: boolean; updated_at: string };
  });

const opt = (s: z.ZodString) => z.union([s, z.literal("")]).transform((v) => (v === "" ? null : v));
export const emailSettingsSchema = z.object({
  notification_recipient: opt(z.string().trim().email("Podaj poprawny adres e-mail").max(255)),
  sender_name: z.string().trim().min(1, "Podaj nazwę nadawcy").max(100),
  sender_local_part: z.string().trim().min(1, "Podaj część adresu przed @").max(64).regex(/^[a-z0-9._-]+$/i, "Dozwolone litery, cyfry, kropka, myślnik i podkreślnik"),
  sender_domain: opt(z.string().trim().toLowerCase().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Podaj poprawną domenę, np. powiadomienia.twojadomena.pl")),
  admin_inbox_url: opt(z.string().trim().url("Podaj pełny adres URL").max(500)),
  contact_notifications_enabled: z.boolean(),
  newsletter_notifications_enabled: z.boolean(),
  newsletter_double_opt_in: z.boolean(),
});

export const updateEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error, count } = await context.supabase.from("email_settings")
      .update({ ...data, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", 1);
    if (error || !count) throw new Error("Nie udało się zapisać ustawień.");
    return { ok: true as const };
  });

const logFilter = z.object({
  kind: z.enum(["all", "contact_message", "newsletter_signup"]).default("all"),
  status: z.enum(["all", "sent", "skipped", "failed", "suppressed"]).default("all"),
});

export const listNotificationLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => logFilter.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("email_notification_log").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać historii powiadomień.");
    return rows as Array<{ id: string; kind: string; related_id: string | null; recipient: string | null; status: string; reason: string | null; created_at: string }>;
  });

// ---- Moderacja społeczności ----
export const listCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["all", "published", "hidden"]).default("all") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("community_posts")
      .select("id, author_name, body, status, created_at, community_comments(id, author_name, body, created_at)")
      .order("created_at", { ascending: false }).limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Nie udało się pobrać treści społeczności.");
    return rows as Array<{ id: string; author_name: string; body: string; status: string; created_at: string; community_comments: Array<{ id: string; author_name: string; body: string; created_at: string }> }>;
  });

export const moderateCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.discriminatedUnion("action", [
    z.object({ action: z.enum(["hide", "restore", "delete_post"]), id: z.string().uuid() }),
    z.object({ action: z.literal("delete_comment"), id: z.string().uuid() }),
  ]).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const res = data.action === "delete_comment"
      ? await db.from("community_comments").delete().eq("id", data.id).select("id")
      : data.action === "delete_post"
        ? await db.from("community_posts").delete().eq("id", data.id).select("id")
        : await db.from("community_posts").update({ status: data.action === "hide" ? "hidden" : "published" }).eq("id", data.id).select("id");
    if (res.error || !res.data?.length) throw new Error("Nie udało się wykonać operacji.");
    return { ok: true };
  });
