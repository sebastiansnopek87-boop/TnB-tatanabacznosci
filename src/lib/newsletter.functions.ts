import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export const NEWSLETTER_CONSENT_VERSION = "2026-09-28";
export const NEWSLETTER_CONSENT_TEXT =
  "Wyrażam zgodę na otrzymywanie newslettera Tata Na Baczności na podany adres e-mail. Zgodę mogę wycofać w każdej chwili.";

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(255, "Adres jest za długi"),
  consent: z.boolean().refine((v) => v, "Zaznacz zgodę na otrzymywanie newslettera"),
});

const subscribeInput = newsletterSchema.extend({
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});

export type SubscribeResult = { status: "subscribed" | "already" | "resubscribed" | "pending" };

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscribeInput.parse(d))
  .handler(async ({ data }): Promise<SubscribeResult> => {
    if (data.website || data.elapsedMs < 1500) throw new Error("Zapis odrzucony przez filtr antyspamowy.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { hashIp, notifyAdmin } = await import("./notifications.server");
    const ipHash = await hashIp(getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim());
    const ua = (getRequestHeader("user-agent") ?? "").slice(0, 300);

    if (ipHash) {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("updated_at", since);
      if ((count ?? 0) >= 5) throw new Error("Zbyt wiele prób. Spróbuj ponownie później.");
    }

    const { data: settings } = await db.from("email_settings").select("newsletter_double_opt_in").eq("id", 1).maybeSingle();
    const double = !!settings?.newsletter_double_opt_in;
    const now = new Date().toISOString();
    const newStatus = double ? "pending" : "active";
    const consent = {
      consent_text: NEWSLETTER_CONSENT_TEXT, consent_version: NEWSLETTER_CONSENT_VERSION, consent_given_at: now,
      opt_in_method: double ? "double" : "single", ip_hash: ipHash, user_agent: ua, updated_at: now,
    };

    const { data: existing } = await db.from("newsletter_subscribers").select("id,status,subscribe_count").ilike("email", data.email).maybeSingle();
    if (existing?.status === "active") return { status: "already" };

    let id: string;
    if (existing) {
      const { error } = await db.from("newsletter_subscribers").update({
        ...consent, status: newStatus, unsubscribed_at: null, confirmed_at: double ? null : now,
        confirm_token: crypto.randomUUID(), subscribe_count: existing.subscribe_count + 1,
      }).eq("id", existing.id);
      if (error) { console.error("newsletter update", error.message); throw new Error("Nie udało się zapisać adresu."); }
      id = existing.id;
    } else {
      const { data: row, error } = await db.from("newsletter_subscribers").insert({
        ...consent, email: data.email, status: newStatus, source: "homepage", confirmed_at: double ? null : now,
      }).select("id").single();
      if (error || !row) { console.error("newsletter insert", error?.message); throw new Error("Nie udało się zapisać adresu."); }
      id = row.id;
    }
    await notifyAdmin({ kind: "newsletter_signup", id, receivedAt: now });
    if (double) return { status: "pending" };
    return { status: existing ? "resubscribed" : "subscribed" };
  });

const unsubInput = z.union([
  z.object({ token: z.string().uuid() }),
  z.object({ email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(255), website: z.string().max(0).optional().default("") }),
]);

export const unsubscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => unsubInput.parse(d))
  .handler(async ({ data }) => {
    if ("website" in data && data.website) throw new Error("Odrzucono.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const q = db.from("newsletter_subscribers").update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now }).neq("status", "unsubscribed");
    const { error } = "token" in data ? await q.eq("unsubscribe_token", data.token) : await q.ilike("email", data.email);
    if (error) { console.error("unsubscribe", error.message); throw new Error("Nie udało się wypisać adresu."); }
    // Same response whether or not the address existed (no enumeration).
    return { ok: true as const };
  });
