import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { unsubscribeNewsletter } from "@/lib/newsletter.functions";

const TITLE = "Wypisz się z newslettera — Tata Na Baczności";
const DESC = "Wycofaj zgodę na otrzymywanie newslettera Tata Na Baczności.";

export const Route = createFileRoute("/newsletter/wypisz")({
  validateSearch: z.object({ token: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const { token } = Route.useSearch();
  const send = useServerFn(unsubscribeNewsletter);
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(token ? "busy" : "idle");
  const [err, setErr] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    send({ data: { token } }).then(() => setState("done")).catch(() => setState("error"));
  }, [token, send]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!z.string().email().safeParse(email.trim()).success) { setErr("Podaj poprawny adres e-mail"); return; }
    setErr("");
    setState("busy");
    try { await send({ data: { email, website: hp } }); setState("done"); } catch { setState("error"); }
  }

  return (
    <PageShell>
      <PageHeading eyebrow="Newsletter" title="Wypisz się" intro="Możesz w każdej chwili wycofać zgodę na otrzymywanie newslettera." />
      <div className="max-w-xl px-5 py-14 lg:px-14">
        {state === "done" ? (
          <p role="status" className="border border-gold/60 bg-surface p-6 text-foreground">
            Jeśli adres był zapisany, został wypisany z newslettera. Nie będziesz już otrzymywać od nas wiadomości.
          </p>
        ) : token && state === "busy" ? (
          <p className="text-muted-foreground">Wypisywanie…</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-[0.72rem] uppercase tracking-[0.14em] text-foreground/80">Adres e-mail</span>
              <input type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} className="w-full border border-border bg-background/60 px-4 py-3 text-[0.9rem] text-foreground focus:border-gold focus:outline-none" />
              {err && <span className="mt-2 block text-[0.8rem] text-destructive">{err}</span>}
            </label>
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>
            {state === "error" && <p role="alert" className="text-[0.85rem] text-destructive">Nie udało się wypisać adresu. Spróbuj ponownie.</p>}
            <button type="submit" disabled={state === "busy"} className="w-fit bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60">
              {state === "busy" ? "Wypisywanie…" : "Wypisz mnie"}
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
