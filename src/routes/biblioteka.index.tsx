import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, Lock, Crown } from "lucide-react";
import { AiRecommender } from "@/components/library/AiRecommender";
import { PageShell } from "@/components/tnb/PageShell";
import { ACCESS_FILTER, KINDS, accessLabel, coverSrc, fmtDay, listCategories, listLibrary, type Access, type Kind, type LibraryItem } from "@/lib/library";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  kategoria: fallback(z.string(), "").default(""),
  format: fallback(z.string(), "").default(""),
  dostep: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "").default(""),
});

const TITLE = "Biblioteka TNB — Tata Na Baczności";
const DESC = "Miejsce, w którym gromadzimy wiedzę, doświadczenia i materiały, do których warto wracać.";

export const Route = createFileRoute("/biblioteka/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

const chip = "border px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.12em] transition-colors";
const chipOn = "border-gold bg-gold/10 text-gold";
const chipOff = "border-border/60 text-foreground/70 hover:border-gold/60 hover:text-foreground";

function Library() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: "/biblioteka/" });
  const access = (sp.dostep in ACCESS_FILTER ? sp.dostep : null) as Access | null;
  const kind = (sp.format in KINDS ? sp.format : null) as Kind | null;
  const category = sp.kategoria || null;
  const sort = sp.sort === "az" ? "az" : "newest";
  const [input, setInput] = useState(sp.q);
  const q = sp.q.slice(0, 80);
  type Patch = Partial<{ q: string; kategoria: string; format: string; dostep: string; sort: string }>;
  const set = (p: Patch) => navigate({ search: (prev) => ({ ...prev, ...p }), replace: true });
  const setCategory = (v: string | null) => set({ kategoria: v ?? "" });
  const setAccess = (v: Access | null) => set({ dostep: v ?? "" });
  useEffect(() => { const t = setTimeout(() => { if (input !== sp.q) set({ q: input }); }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = useQuery({ queryKey: ["library-cats"], queryFn: listCategories });
  const list = useQuery({ queryKey: ["library", q, category, access, kind, sort], queryFn: () => listLibrary({ q, category, access, kind, sort }) });
  const catName = (s: string) => cats.data?.find((c) => c.slug === s)?.name ?? s;
  const filtered = !!(q.trim().length >= 2 || category || access || kind);

  return (
    <PageShell>
      <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
        <p className="eyebrow text-gold">Wiedza dla ojców</p>
        <h1 className="mt-4 font-display text-[2.6rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.4rem]">Biblioteka TNB</h1>
        <p className="mt-6 max-w-2xl text-[0.95rem] leading-[1.75] text-foreground/80">{DESC}</p>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-14">
        <AiRecommender />
        <div className="space-y-5 border border-border/60 bg-surface-deep p-5 sm:p-6">
          <label className="relative block">
            <span className="sr-only">Szukaj materiałów</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={80} placeholder="Szukaj materiałów…"
              className="w-full border border-border/60 bg-background py-3 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none" />
          </label>
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Kategoria</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCategory(null)} className={`${chip} ${!category ? chipOn : chipOff}`}>Wszystkie</button>
              {cats.data?.map((c) => (
                <button key={c.slug} type="button" onClick={() => setCategory(c.slug)} className={`${chip} ${category === c.slug ? chipOn : chipOff}`}>{c.name}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Dostępność</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAccess(null)} className={`${chip} ${!access ? chipOn : chipOff}`}>Wszystkie</button>
              {(Object.keys(ACCESS_FILTER) as Access[]).map((a) => (
                <button key={a} type="button" onClick={() => setAccess(a)} className={`${chip} ${access === a ? chipOn : chipOff}`}>{ACCESS_FILTER[a]}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-2 block text-muted-foreground">Format</span>
              <select value={kind ?? ""} onChange={(e) => set({ format: e.target.value })} className="w-full border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none">
                <option value="">Każdy format</option>
                {(Object.keys(KINDS) as Kind[]).map((k) => <option key={k} value={k}>{KINDS[k]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block text-muted-foreground">Sortowanie</span>
              <select value={sort} onChange={(e) => set({ sort: e.target.value === "az" ? "az" : "" })} className="w-full border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none">
                <option value="newest">Najnowsze</option>
                <option value="az">Alfabetycznie</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-10">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie materiałów…</p>
          ) : list.error ? (
            <div className="border border-destructive/50 p-5 text-sm text-foreground/80">
              Nie udało się wczytać biblioteki. <button className="text-gold underline" onClick={() => list.refetch()}>Spróbuj ponownie</button>
            </div>
          ) : !list.data?.length ? (
            <div className="border border-gold/40 bg-surface-deep p-8 text-center">
              <p className="font-display text-2xl font-semibold uppercase text-foreground">{filtered ? "Brak wyników" : "Biblioteka jest jeszcze pusta"}</p>
              <p className="mt-3 text-sm text-foreground/70">
                {filtered ? "Nie znaleźliśmy materiałów dla wybranych filtrów. Zmień wyszukiwanie lub filtry." : "Pierwsze materiały pojawią się tutaj wkrótce."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 border-y border-border/60">
              {list.data.map((it) => <ItemCard key={it.id} it={it} cat={catName(it.category)} />)}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// CTA label reflects only data the catalogue actually has (access + free delivery mode).
function ctaLabel(it: LibraryItem) {
  if (it.access === "public" && (it.free_delivery === "form_download" || it.free_delivery === "email")) return "Odbierz bezpłatny materiał";
  return "Zobacz szczegóły";
}

function ItemCard({ it, cat }: { it: LibraryItem; cat: string }) {
  const img = coverSrc(it);
  return (
    <article className="grid min-w-0 gap-6 py-8 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-12 lg:py-10">
      <Link to="/biblioteka/$slug" params={{ slug: it.slug }} aria-hidden tabIndex={-1}
        className="mx-auto block w-full max-w-[240px] self-start border border-gold/30 bg-surface-deep p-2 transition-colors hover:border-gold/70 sm:mx-0 sm:max-w-none">
        {img ? (
          <img src={img} alt="" loading="lazy" className="block h-auto max-h-[360px] w-full object-contain" />
        ) : (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 border border-gold/20 px-4 text-center">
            <span className="h-px w-10 bg-gold/60" />
            <span className="font-display text-lg font-semibold uppercase leading-tight tracking-[0.08em] text-gold">Biblioteka<br />TNB</span>
            <span className="h-px w-10 bg-gold/60" />
            <span className="eyebrow text-[0.6rem] text-muted-foreground">{KINDS[it.kind]}</span>
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] uppercase tracking-[0.14em]">
          <span className="text-gold">{cat}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {it.access === "premium" ? <Crown className="h-3.5 w-3.5 text-gold" /> : it.access === "members" ? <Lock className="h-3.5 w-3.5" /> : null}
            <span className={it.access === "premium" ? "text-gold" : ""}>{accessLabel(it)}</span>
          </span>
        </div>
        <h2 className="mt-3 break-words font-display text-2xl font-semibold leading-tight text-foreground lg:text-[1.9rem]">{it.title}</h2>
        <p className="mt-2 text-sm text-foreground/70">
          {it.author_name && <span>{it.author_name}</span>}
          {it.author_name && <span className="mx-2 text-gold/60">·</span>}
          <span>{KINDS[it.kind]}</span>
        </p>
        {it.summary && <p className="mt-4 max-w-2xl break-words text-[0.95rem] leading-[1.75] text-foreground/80">{it.summary}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Opublikowano: {fmtDay(it.published_at)}</p>
        <div className="mt-6">
          <Link to="/biblioteka/$slug" params={{ slug: it.slug }}
            className="block w-full bg-gold px-6 py-3 text-center text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright sm:inline-block sm:w-auto">
            {ctaLabel(it)}
          </Link>
        </div>
      </div>
    </article>
  );
}
