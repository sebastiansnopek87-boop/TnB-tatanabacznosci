import { createFileRoute } from "@tanstack/react-router";

// Serves images of published meetings only (bucket is private).
export const Route = createFileRoute("/api/public/meeting-image/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: m } = await supabaseAdmin.from("meetings").select("image_url, status").eq("id", params.id).maybeSingle();
        if (!m?.image_url || m.status === "draft") return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("meeting-images").download(m.image_url);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, { headers: { "content-type": blob.type || "image/jpeg", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
