import { createFileRoute } from "@tanstack/react-router";

// Serves covers of published episodes only (bucket is private; audio is never served here).
export const Route = createFileRoute("/api/public/podcast-cover/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: e } = await supabaseAdmin.from("podcast_episodes").select("cover_path, status").eq("id", params.id).maybeSingle();
        if (!e?.cover_path || e.status !== "published") return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("podcast-files").download(e.cover_path);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, { headers: { "content-type": blob.type || "image/jpeg", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
