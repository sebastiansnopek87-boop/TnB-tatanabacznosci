// Guest comments under articles: submit -> e-mail link -> confirm. The comment is never public before
// a valid, unused, unexpired token is presented. Only the SHA-256 of the token is stored.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export const GUEST_COMMENT_RULES = "Akceptuję zasady komentowania: piszę z szacunkiem, bez ataków personalnych i danych wrażliwych. Moderator może ukryć komentarz naruszający zasady.";
const TTL_HOURS = 48;
const MAX_SENDS = 3;

const guestInput = z.object({
  articleId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Podaj imię.").max(60).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Imię zawiera niedozwolone znaki."),
  lastName: z.string().trim().min(1, "Podaj nazwisko.").max(80).regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Nazwisko zawiera niedozwolone znaki."),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
  body: z.string().trim().min(2, "Komentarz jest za krótki.").max(2000, "Komentarz jest za długi."),
  rules: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj zasady komentowania." }) }),
  website: z.string().max(0).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
});

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendLink(db: any, c: { id: string; first: string; email: string; title: string; send: number }) {
  const token = newToken();
  const expires = new Date(Date.now() + TTL_HOURS * 3600_000).toISOString();
  await db.from("article_comment_guests").update({ token_hash: await sha256(token), token_expires_at: expires, token_used_at: null }).eq("comment_id", c.id);
  const { siteOrigin } = await import("./orders.server");
  const { dispatch } = await import("./notifications.server");
  await dispatch({
    event: "article_comment_confirm", to: c.email, relatedId: c.id, idempotencyKey: `article-comment-${c.id}-${c.send}`,
    vars: { imie: c.first, tytul_artykulu: c.title, waznosc_linku: `${TTL_HOURS} godzin`, link_do_potwierdzenia: `${siteOrigin()}/komentarz/potwierdz?t=${token}` },
  });
}

export const submitGuestComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => guestInput.parse(d))
  .handler(async ({ data }) => {
    // Same neutral answer for spam filters, limits and success: nothing reveals whether an e-mail was used before.
    const ok = { status: "check_email" as const };
    if (data.website || data.elapsedMs < 3000) return ok;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { hashIp } = await import("./notifications.server");
    const { logEvent } = await import("./admin-auth.server");
    const ipHash = await hashIp(getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim());
    const { data: art } = await db.from("articles").select("id, title, status, published_at").eq("id", data.articleId).maybeSingle();
    if (!art || art.status !== "published" || !art.published_at || new Date(art.published_at) > new Date()) throw new Error("Ten artykuł nie przyjmuje komentarzy.");

    const since = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    if (ipHash) {
      const { count: lastMin } = await db.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(1));
      const { count: lastHour } = await db.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(60));
      if ((lastMin ?? 0) >= 1 || (lastHour ?? 0) >= 5) throw new Error("Wysłano zbyt wiele komentarzy. Spróbuj ponownie później.");
    }
    const { count: perEmail } = await db.from("article_comment_guests").select("comment_id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", since(60));
    if ((perEmail ?? 0) >= 5) return ok;

    const author = `${data.firstName} ${data.lastName}`.replace(/\s+/g, " ");
    const { data: row, error } = await db.from("article_comments").insert({ article_id: art.id, body: data.body, author_name: author } as never).select("id").single();
    if (error || !row) throw new Error("Nie udało się zapisać komentarza. Spróbuj ponownie.");
    await db.from("article_comment_guests").insert({ comment_id: row.id, first_name: data.firstName, last_name: data.lastName, email: data.email, ip_hash: ipHash } as never);
    await sendLink(db, { id: row.id, first: data.firstName, email: data.email, title: art.title, send: 1 });
    await logEvent({ type: "article_comment_guest_submitted", objectKind: "article_comment", objectId: row.id });
    return ok;
  });

type ConfirmResult = { status: "published" | "invalid" | "used" | "expired" | "blocked"; slug?: string | undefined; canResend?: boolean };

export const confirmGuestComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }): Promise<ConfirmResult> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { logEvent } = await import("./admin-auth.server");
    const { data: g } = await db.from("article_comment_guests").select("comment_id, token_expires_at, token_used_at, sends").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!g) return { status: "invalid" };
    const { data: c } = await db.from("article_comments").select("id, status, articles(slug)").eq("id", g.comment_id).maybeSingle();
    const slug = (c as any)?.articles?.slug as string | undefined;
    if (!c) return { status: "invalid" };
    if (g.token_used_at) return { status: "used", slug };
    if (!["pending_email", "expired"].includes(c.status)) {
      await logEvent({ type: "article_comment_confirm_blocked", objectKind: "article_comment", objectId: c.id, result: "denied" });
      return { status: "blocked", slug };
    }
    if (!g.token_expires_at || new Date(g.token_expires_at) < new Date()) {
      await db.from("article_comments").update({ status: "expired" } as never).eq("id", c.id);
      await logEvent({ type: "article_comment_confirm_expired", objectKind: "article_comment", objectId: c.id, result: "failed" });
      return { status: "expired", slug, canResend: g.sends < MAX_SENDS };
    }
    // Single-use: mark the token used atomically; a concurrent second click loses this race.
    const now = new Date().toISOString();
    const { data: used } = await db.from("article_comment_guests").update({ token_used_at: now, confirmed_at: now } as never).eq("comment_id", c.id).is("token_used_at", null).select("comment_id");
    if (!used?.length) return { status: "used", slug };
    await db.from("article_comments").update({ status: "confirmed" } as never).eq("id", c.id).in("status", ["pending_email", "expired"]);
    await db.from("article_comments").update({ status: "visible" } as never).eq("id", c.id).eq("status", "confirmed");
    await logEvent({ type: "article_comment_confirmed", objectKind: "article_comment", objectId: c.id });
    return { status: "published", slug };
  });

export const resendGuestComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const neutral = { status: "sent_if_possible" as const };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { logEvent } = await import("./admin-auth.server");
    const { data: g } = await db.from("article_comment_guests").select("comment_id, first_name, email, token_used_at, sends, last_sent_at").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!g || g.token_used_at || g.sends >= MAX_SENDS || Date.now() - new Date(g.last_sent_at).getTime() < 10 * 60_000) return neutral;
    const { data: c } = await db.from("article_comments").select("id, status, articles(title)").eq("id", g.comment_id).maybeSingle();
    if (!c || !["pending_email", "expired"].includes(c.status)) return neutral;
    const send = g.sends + 1;
    await db.from("article_comment_guests").update({ sends: send, last_sent_at: new Date().toISOString() } as never).eq("comment_id", c.id);
    await db.from("article_comments").update({ status: "pending_email" } as never).eq("id", c.id);
    await sendLink(db, { id: c.id, first: g.first_name, email: g.email, title: (c as any).articles?.title ?? "", send });
    await logEvent({ type: "article_comment_confirm_resent", objectKind: "article_comment", objectId: c.id });
    return neutral;
  });
