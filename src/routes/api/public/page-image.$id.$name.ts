import { createFileRoute } from "@tanstack/react-router";

// Serves images only of published pages and only when the published content references them.
export const Route = createFileRoute("/api/public/page-image/$id/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id) || !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(params.name)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: p } = await supabaseAdmin.from("site_pages").select("status, sections").eq("id", params.id).maybeSingle();
        const used = Array.isArray(p?.sections) && (p!.sections as any[]).some((s) => s?.image === params.name || (Array.isArray(s?.items) && s.items.some((it: any) => it?.image === params.name)));
        if (!p || p.status !== "published" || !used) return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("page-images").download(`${params.id}/${params.name}`);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, { headers: { "content-type": blob.type || "image/jpeg", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
