import { createFileRoute } from "@tanstack/react-router";

// Serves branding images only when platform_settings.brand_settings actually references them.
const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|ico)$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", ico: "image/x-icon" };
const KEYS = ["logo", "favicon", "og_image", "header_image"];

export const Route = createFileRoute("/api/public/brand/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!FILE_RE.test(params.file)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin.from("platform_settings").select("brand_settings").eq("id", 1).maybeSingle();
        const bs = (row?.brand_settings ?? {}) as Record<string, unknown>;
        const wanted = `brand/${params.file}`;
        if (!KEYS.some((k) => bs[k] === wanted)) return new Response("Not found", { status: 404 });
        const { data: blob, error } = await supabaseAdmin.storage.from("media").download(wanted);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(blob, {
          headers: { "content-type": TYPES[params.file.split(".").pop()!] || "application/octet-stream", "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
