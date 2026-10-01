import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { recommendLibrary } from "@/lib/recommend.functions";
import type { Recommendation } from "@/lib/ai/recommend.server";

export function AiRecommender() {
  const run = useServerFn(recommendLibrary);
  const [need, setNeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[] | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (need.trim().length < 10) return setError("Opisz potrzebę w co najmniej 10 znakach.");
    setBusy(true); setItems(null);
    try {
      const r = await run({ data: { need } });
      if (r.ok) setItems(r.items); else setError(r.error);
    } catch {
      setError("Nie udało się dobrać materiałów. Spróbuj ponownie.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="ai-rec" className="mb-8 border border-gold/40 bg-surface-deep p-5 sm:p-6">
      <h2 id="ai-rec" className="flex items-center gap-2 font-display text-xl font-semibold uppercase tracking-[0.04em] text-foreground">
        <Sparkles className="h-4 w-4 text-gold" /> Czego potrzebujesz?
      </h2>
      <p className="mt-2 text-sm text-foreground/70">Opisz swoją sytuację własnymi słowami — AI wskaże pasujące materiały z Biblioteki.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="sr-only" htmlFor="ai-need">Opis potrzeby</label>
        <textarea id="ai-need" value={need} onChange={(e) => setNeed(e.target.value)} maxLength={600} rows={3}
          placeholder="Np. Syn ma 14 lat i przestał ze mną rozmawiać. Szukam sposobu, jak odbudować kontakt."
          className="w-full border border-border/60 bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{need.length}/600 · nie podawaj danych osobowych</span>
          <button type="submit" disabled={busy} className="border border-gold bg-gold/10 px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.15em] text-gold transition-colors hover:bg-gold/20 disabled:opacity-60">
            {busy ? "Szukam…" : "Dobierz materiały"}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {items && (items.length === 0
        ? <p className="mt-5 text-sm text-foreground/70">Nie znalazłem materiału, który dobrze pasuje. Spróbuj opisać potrzebę inaczej albo przejrzyj listę poniżej.</p>
        : <ol className="mt-5 space-y-3">
            {items.map((it) => (
              <li key={it.slug} className="border border-border/60 bg-background/40 p-4">
                <Link to="/biblioteka/$slug" params={{ slug: it.slug }} className="font-medium text-gold hover:underline">{it.title}</Link>
                {it.reason && <p className="mt-1 text-sm text-foreground/75">{it.reason}</p>}
              </li>
            ))}
          </ol>)}
    </section>
  );
}
