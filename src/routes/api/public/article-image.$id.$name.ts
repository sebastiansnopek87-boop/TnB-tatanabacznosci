import { createFileRoute } from "@tanstack/react-router";

// Serves images only of published (and already released) articles, and only files the article references.
export const Route = createFileRoute("/api/public/article-image/$id/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id) || !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(params.name)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: a } = await supabaseAdmin.from("articles").select("status, published_at, cover, sections").eq("id", params.id).maybeSingle();
        const live = a && a.status === "published" && a.published_at && new Date(a.published_at) <= new Date();
        const used = a && (a.cover === params.name || (Array.isArray(a.sections) && (a.sections as any[]).some((s) => s?.image === params.name)));
        if (!live || !used) return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("article-images").download(`${params.id}/${params.name}`);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, { headers: { "content-type": blob.type || "image/jpeg", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
