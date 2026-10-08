import { createFileRoute } from "@tanstack/react-router";

// Meta OAuth redirect target. Public by necessity; trust comes only from the single-use,
// 10-minute state created by an admin in the panel (instagram_secret.oauth_state).
export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const back = (q: string) => new Response(null, { status: 302, headers: { Location: `/admin/podcast?instagram=${q}#instagram` } });
        const state = u.searchParams.get("state") ?? "", code = u.searchParams.get("code") ?? "";
        if (u.searchParams.get("error") || !state || !code) return back("anulowano");
        const ig = await import("@/lib/instagram.server");
        const { logEvent } = await import("@/lib/admin-auth.server");
        try {
          const r = await ig.finishOAuth(state, code);
          await logEvent({ type: "instagram_connect", actor: r.actor, objectKind: "instagram_source", detail: `@${r.username}` });
          await ig.sync().catch(() => {});
          return back("polaczono");
        } catch (e) {
          await logEvent({ type: "instagram_connect", objectKind: "instagram_source", result: "failed", detail: (e instanceof Error ? e.message : "błąd").slice(0, 300) }).catch(() => {});
          return back("blad");
        }
      },
    },
  },
});
