import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/tnb/PageShell";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { getOrderResult } from "@/lib/orders.functions";
import { fmtPrice } from "@/lib/library";

export const Route = createFileRoute("/zakup/wynik")({
  validateSearch: (s: Record<string, unknown>) => ({
    order: typeof s["order"] === "string" ? s["order"] : "",
    session_id: typeof s["session_id"] === "string" ? s["session_id"] : "",
  }),
  head: () => ({ meta: [
    { title: "Status zamówienia — Tata Na Baczności" }, { name: "description", content: "Status Twojego zamówienia materiału premium." },
    { property: "og:title", content: "Status zamówienia — TNB" }, { property: "og:description", content: "Status Twojego zamówienia materiału premium." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Result,
});

function Result() {
  const { order, session_id } = Route.useSearch();
  const valid = /^[0-9a-f-]{36}$/.test(order) && session_id.length >= 10;
  const q = useQuery({
    queryKey: ["order-result", order, session_id], enabled: valid,
    queryFn: () => getOrderResult({ data: { orderId: order, sessionId: session_id } }),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
  });
  const r = q.data;
  return (
    <PageShell>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-2xl px-5 py-14">
        <p className="eyebrow text-gold">Zamówienie</p>
        {!valid || (q.isFetched && !r) ? (
          <Box title="Nie znaleziono zamówienia" text="Link jest niepełny albo nieprawidłowy." />
        ) : !r ? (
          <p className="mt-6 text-sm text-muted-foreground">Sprawdzamy status płatności…</p>
        ) : r.status === "paid" ? (
          <Box title="Dziękujemy za zakup!" text={`Płatność za „${r.title}” (${fmtPrice(r.amount)}) została potwierdzona.${r.delivery === "sent" ? ` Materiał wysłaliśmy na ${r.email}.` : " Materiał możesz otworzyć od razu poniżej. Zachowaj ten link."}`}>
            {r.token && <Link to="/zakup/$token" params={{ token: r.token }} className="mt-6 inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Otwórz materiał</Link>}
          </Box>
        ) : r.status === "pending" ? (
          <Box title="Czekamy na potwierdzenie płatności" text="To zwykle trwa kilka sekund. Strona odświeży się sama — nie zamykaj jej." />
        ) : (
          <Box title={r.status === "failed" ? "Płatność nie powiodła się" : r.status === "refunded" ? "Zamówienie zwrócone" : "Płatność anulowana"} text="Nie przyznaliśmy dostępu do materiału. Możesz spróbować ponownie.">
            {r.slug && <Link to="/biblioteka/$slug" params={{ slug: r.slug }} className="mt-6 inline-block border border-gold/60 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold">Spróbuj ponownie</Link>}
          </Box>
        )}
      </div>
    </PageShell>
  );
}

function Box({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mt-6 border border-gold/50 bg-surface-deep p-6 sm:p-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
      <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">{text}</p>
      {children}
    </div>
  );
}
