import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Replay protection: each operator event id is processed once.
  const { error: dup } = await supabaseAdmin.from("payment_webhook_events").insert({ event_id: event.id, environment: env, type: event.type });
  if (dup) { if (dup.code === "23505") return; throw dup; }
  const { markOrderPaid, markOrderStatus } = await import("@/lib/orders.server");
  const o = event.data.object;
  const orderId: string | undefined = o?.metadata?.order_id ?? o?.client_reference_id;

  switch (event.type) {
    case "checkout.session.completed":
      if (!orderId) return;
      if (o.payment_status !== "unpaid") await markOrderPaid(orderId, o.payment_intent ?? null, event.type);
      break;
    case "checkout.session.async_payment_succeeded":
      if (orderId) await markOrderPaid(orderId, o.payment_intent ?? null, event.type);
      break;
    case "checkout.session.async_payment_failed":
      if (orderId) await markOrderStatus(orderId, "failed", "Operator zgłosił nieudaną płatność.");
      break;
    case "checkout.session.expired":
      if (orderId) await markOrderStatus(orderId, "cancelled", "Sesja płatności wygasła.");
      break;
    case "payment_intent.payment_failed":
      if (orderId) await supabaseAdmin.from("library_order_events").insert({ order_id: orderId, type: "payment_attempt_failed", detail: o.last_payment_error?.message ?? "Próba płatności odrzucona." });
      break;
    case "charge.refunded": {
      const pi = o.payment_intent;
      if (!pi || !o.refunded) return;
      const { data } = await supabaseAdmin.from("library_orders").select("id").eq("provider_ref", pi).maybeSingle();
      if (data) await markOrderStatus(data.id, "refunded", "Zwrot potwierdzony przez operatora.");
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
