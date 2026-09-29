import { createFileRoute } from "@tanstack/react-router";

// Serves covers of published materials only (bucket is private); drafts/archived stay hidden.
export const Route = createFileRoute("/api/public/library-cover/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: item } = await supabaseAdmin.from("library_items").select("cover_url, status").eq("id", params.id).maybeSingle();
        if (!item?.cover_url || item.status !== "published") return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("library-files").download(item.cover_url);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, { headers: { "content-type": blob.type || "image/jpeg", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
