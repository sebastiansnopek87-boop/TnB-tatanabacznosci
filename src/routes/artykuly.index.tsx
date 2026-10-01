import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { Input } from "@/components/ui/input";
import { articleCategoriesQuery, articlesQuery } from "@/lib/articles";

export const Route = createFileRoute("/artykuly/")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(articlesQuery()), context.queryClient.ensureQueryData(articleCategoriesQuery())]),
  head: () => ({
    meta: [
      { title: "Artykuły — Tata Na Baczności" },
      { name: "description", content: "Autorskie artykuły Sebastiana: ojcostwo, rodzina, życie po służbie, wiara, emocje i budowanie własnej drogi." },
      { property: "og:title", content: "Artykuły — Tata Na Baczności" },
      { property: "og:description", content: "Myśli, doświadczenia i historie o ojcostwie, służbie i wartościach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Articles,
});

function Articles() {
  const { data: items } = useSuspenseQuery(articlesQuery());
  const { data: cats } = useSuspenseQuery(articleCategoriesQuery());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const name = (s: string | null) => cats.find((c) => c.slug === s)?.name;
  const used = cats.filter((c) => items.some((a) => a.category === c.slug));
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((a) => (!cat || a.category === cat) && (s.length < 2 || `${a.title} ${a.excerpt}`.toLowerCase().includes(s)));
  }, [items, q, cat]);
  const chip = (on: boolean) => `border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors ${on ? "border-gold bg-gold/10 text-gold" : "border-border/60 text-muted-foreground hover:text-foreground"}`;

  return (
    <PageShell>
      <PageHeading eyebrow="Artykuły" title="Artykuły" intro="Myśli, doświadczenia i historie, którymi chcę się z Wami podzielić. To teksty redakcyjne — rozmawiać o nich możesz w Rozmowach społeczności." />
      <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-14 lg:py-14">
        {items.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w artykułach…" aria-label="Szukaj w artykułach" className="pl-9" maxLength={80} />
            </div>
            {used.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie">
                <button type="button" className={chip(!cat)} aria-pressed={!cat} onClick={() => setCat(null)}>Wszystkie</button>
                {used.map((c) => <button key={c.slug} type="button" className={chip(cat === c.slug)} aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</button>)}
              </div>
            )}
          </div>
        )}
        {items.length === 0 ? (
          <p className="border border-dashed border-gold/40 px-6 py-14 text-center text-[0.95rem] leading-[1.75] text-foreground/80">
            Przygotowuję pierwsze artykuły. Wkrótce znajdziesz tu teksty o ojcostwie, służbie i wartościach.
          </p>
        ) : shown.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">Brak artykułów pasujących do wyszukiwania.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => <ArticleCard key={a.id} a={a} category={name(a.category)} />)}
          </div>
        )}
      </div>
    </PageShell>
  );
}
