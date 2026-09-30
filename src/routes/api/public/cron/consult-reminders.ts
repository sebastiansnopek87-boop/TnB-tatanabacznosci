import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled job: sends 24h reminders for active 1:1 bookings. Requires the cron secret.
export const Route = createFileRoute("/api/public/cron/consult-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { processReminders } = await import("@/lib/consult.server");
        return Response.json(await processReminders());
      },
    },
  },
});
