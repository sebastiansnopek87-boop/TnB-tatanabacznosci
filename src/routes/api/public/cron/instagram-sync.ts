import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled job: server-side Instagram sync (only if data is stale). Requires the cron secret.
export const Route = createFileRoute("/api/public/cron/instagram-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { syncIfStale } = await import("@/lib/instagram.server");
        await syncIfStale();
        return Response.json({ ok: true });
      },
    },
  },
});
