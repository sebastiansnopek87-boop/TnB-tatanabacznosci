import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PageShell } from "@/components/tnb/PageShell";
import { redeemFreeMaterial } from "@/lib/library-delivery.functions";

export const Route = createFileRoute("/biblioteka/pobierz")({
  validateSearch: (s) => z.object({ t: z.string().max(100).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Pobierz materiał — Biblioteka TNB" },
      { name: "description", content: "Odbiór bezpłatnego materiału z Biblioteki TATA NA BACZNOŚCI." },
      { property: "og:title", content: "Pobierz materiał — Biblioteka TNB" },
      { property: "og:description", content: "Odbiór bezpłatnego materiału z Biblioteki TATA NA BACZNOŚCI." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pickup,
});

const MSG = {
  invalid: "Ten link jest nieprawidłowy.",
  expired: "Ten link wygasł. Wypełnij formularz na stronie materiału ponownie.",
  unavailable: "Materiał jest chwilowo niedostępny.",
} as const;

function Pickup() {
  const { t } = Route.useSearch();
  const fn = useServerFn(redeemFreeMaterial);
  const [state, setState] = useState<{ s: "loading" } | { s: "ok"; url: string; title: string } | { s: keyof typeof MSG }>({ s: "loading" });
  async function run() {
    if (!t) return setState({ s: "invalid" });
    setState({ s: "loading" });
    try { const r = await fn({ data: { token: t } }); setState(r.status === "ok" ? { s: "ok", url: r.url, title: r.title } : { s: r.status }); }
    catch { setState({ s: "invalid" }); }
  }
  useEffect(() => { void run(); }, [t]);
  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-3xl font-semibold uppercase">Twój materiał</h1>
        {state.s === "loading" ? <p className="mt-6 text-sm text-muted-foreground">Przygotowywanie pliku…</p>
          : state.s === "ok" ? (<div className="mt-6 space-y-4">
              <p className="text-foreground/85">„{state.title}” jest gotowy do pobrania.</p>
              <a href={state.url} className="inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Pobierz PDF</a>
              <p className="text-xs text-muted-foreground">Przycisk działa przez kilka minut. Jeśli przestanie, <button className="text-gold underline" onClick={run}>przygotuj plik ponownie</button>.</p>
            </div>)
          : <p className="mt-6 text-foreground/85">{MSG[state.s]}</p>}
        <Link to="/biblioteka" className="mt-10 inline-block text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:text-gold-bright">← Biblioteka</Link>
      </div>
    </PageShell>
  );
}
