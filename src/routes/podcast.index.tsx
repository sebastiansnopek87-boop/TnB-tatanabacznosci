import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Headphones, Lock, Search } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { ChannelsSection, ListenSection, StorySection, WatchSection } from "@/components/voice/VoiceSections";
import { listEpisodes } from "@/lib/podcast.functions";
import { listCategories } from "@/lib/library";
import { EP_ACCESS, coverUrl, fmtDay, fmtDuration, type PublicEpisode } from "@/lib/podcast";
import { getPodcastLayout } from "@/lib/platform.functions";

const TITLE = "Głos TNB — historie, rozmowy i głosy ludzi w drodze";
const DESC = "Głos TNB: podcast, rozmowy, materiały wideo i miejsce, w którym możesz zgłosić własną historię. Bez udawania, bez gotowych recept.";

export const Route = createFileRoute("/podcast/")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PodcastPage,
});

function PodcastPage() {
  const eps = useQuery({ queryKey: ["podcast"], queryFn: () => listEpisodes() });
  const layout = useQuery({ queryKey: ["podcast-layout"], queryFn: () => getPodcastLayout() });
  const cats = useQuery({ queryKey: ["library-categories"], queryFn: listCategories });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const catName = (s: string) => cats.data?.find((c) => c.slug === s)?.name ?? s;

  const all = eps.data ?? [];
  const latest = all[0];
  const filtering = q.trim().length > 0 || !!cat;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((e) => (filtering || e.id !== latest?.id)
      && (!cat || e.category === cat)
      && (!s || e.title.toLowerCase().includes(s) || e.summary.toLowerCase().includes(s)));
  }, [all, q, cat, filtering, latest?.id]);
  const usedCats = (cats.data ?? []).filter((c) => all.some((e) => e.category === c.slug));

  return (
    <PageShell>
      <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
        <h1 className="font-display text-[2.6rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.4rem]">Głos TNB</h1>
        <p className="mt-5 max-w-2xl text-[1.1rem] italic text-foreground/85">Historie, rozmowy i głosy ludzi, którzy są w drodze.</p>
      </section>

      <WatchSection />
      <ListenSection />

      <div className="border-t border-border/60 px-5 py-12 lg:px-14">
        <p className="eyebrow text-gold">Podcast</p>
        <h2 className="mt-2 font-display text-2xl font-semibold uppercase text-foreground sm:text-3xl">Rozmowy</h2>
        <p className="mb-10 mt-4 max-w-2xl text-[0.95rem] leading-[1.75] text-foreground/80">
          Rozmowy o życiu, które nie zawsze mieści się w schematach. O rodzinie, odpowiedzialności, doświadczeniach, wartościach i drodze, którą każdy z nas przechodzi na swój sposób. Bez udawania. Bez gotowych recept. Z miejsca, w którym jesteśmy.
        </p>
        {eps.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie odcinków…</p>
          : eps.error ? <p className="text-sm text-destructive">Nie udało się pobrać odcinków. Odśwież stronę.</p>
          : !all.length ? (
            <div className="max-w-2xl border border-gold/40 bg-surface-deep p-8">
              <Headphones className="h-6 w-6 text-gold" />
              <p className="mt-4 font-display text-2xl font-semibold uppercase text-foreground">Brak opublikowanych odcinków</p>
              <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/80">Pierwsze nagrania są w przygotowaniu. Zajrzyj tu wkrótce.</p>
            </div>
          ) : (
            <>
              {latest && !filtering && (
                <section aria-labelledby="latest">
                  <p id="latest" className="eyebrow text-gold">{latest.featured ? "Wyróżniony odcinek" : "Najnowszy odcinek"}</p>
                  <Link to="/podcast/$slug" params={{ slug: latest.slug }} className="group mt-4 grid gap-5 border border-border/60 bg-card p-4 hover:border-gold/60 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr] lg:p-5">
                    <Cover e={latest} className="aspect-square w-full max-w-[200px] border" />
                    <div className="min-w-0">
                      <Meta e={latest} catName={catName} />
                      <h2 className="mt-2 break-words font-display text-xl font-semibold uppercase leading-tight text-foreground group-hover:text-gold lg:text-2xl">{num(latest)}{latest.title}</h2>
                      {latest.subtitle && <p className="mt-2 text-[1rem] italic text-foreground/75">{latest.subtitle}</p>}
                      {latest.summary && <p className="mt-4 text-[0.95rem] leading-[1.75] text-foreground/80">{latest.summary}</p>}
                      <span className="mt-6 inline-flex items-center gap-2 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground">
                        <Headphones className="h-4 w-4" /> {latest.has_audio || latest.has_external ? "Odtwórz odcinek" : "Oczekuje na nagranie"}
                      </span>
                    </div>
                  </Link>
                </section>
              )}

              <section className={latest && !filtering ? "mt-14" : ""}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="font-display text-xl font-semibold uppercase text-foreground">{filtering ? "Wyniki" : "Wszystkie odcinki"}</h3>
                  <label className="relative block w-full lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj odcinka…" aria-label="Szukaj odcinka"
                      className="w-full border border-border bg-surface-deep py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none" />
                  </label>
                </div>
                {usedCats.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Chip active={!cat} onClick={() => setCat(null)}>Wszystkie</Chip>
                    {usedCats.map((c) => <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</Chip>)}
                  </div>
                )}
                {!list.length ? (
                  <p className="mt-8 border border-border/60 p-6 text-sm text-muted-foreground">
                    {filtering ? "Brak odcinków pasujących do wyszukiwania." : "To na razie jedyny opublikowany odcinek."}
                  </p>
                ) : (
                  layout.data === "grid" ? (
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {list.map((e) => (
                        <Link key={e.id} to="/podcast/$slug" params={{ slug: e.slug }} className="group flex flex-col border border-border/60 bg-card hover:border-gold/60">
                          <Cover e={e} className="aspect-video w-full" />
                          <div className="flex flex-1 flex-col p-4">
                            <Meta e={e} catName={catName} />
                            <h3 className="mt-2 break-words font-display text-base font-semibold uppercase leading-snug text-foreground group-hover:text-gold">{num(e)}{e.title}</h3>
                            {e.summary && <p className="mt-2 line-clamp-2 text-[0.82rem] leading-relaxed text-foreground/75">{e.summary}</p>}
                            <span className="mt-auto pt-3 text-[0.7rem] uppercase tracking-[0.14em] text-gold">{e.has_audio || e.has_external ? "▶ Odtwórz" : "Oczekuje na nagranie"}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col gap-3">
                      {list.map((e) => (
                        <Link key={e.id} to="/podcast/$slug" params={{ slug: e.slug }} className="group flex items-start gap-4 border border-border/60 bg-card p-3 hover:border-gold/60 sm:items-center sm:p-4">
                          <Cover e={e} className="aspect-square w-20 shrink-0 border sm:w-28" />
                          <div className="min-w-0 flex-1">
                            <Meta e={e} catName={catName} />
                            <h3 className="mt-1.5 break-words font-display text-base font-semibold uppercase leading-snug text-foreground group-hover:text-gold sm:text-lg">{num(e)}{e.title}</h3>
                            {e.summary && <p className="mt-1 hidden text-[0.85rem] leading-relaxed text-foreground/75 sm:line-clamp-2">{e.summary}</p>}
                          </div>
                          <span className="hidden shrink-0 text-[0.7rem] uppercase tracking-[0.14em] text-gold md:inline">{e.has_audio || e.has_external ? "▶ Odtwórz" : "Oczekuje"}</span>
                        </Link>
                      ))}
                    </div>
                  )
                )}
              </section>
            </>
          )}
      </div>
      <ChannelsSection />
      <StorySection />
    </PageShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`border px-3 py-1.5 text-xs uppercase tracking-[0.1em] ${active ? "border-gold bg-gold text-primary-foreground" : "border-border text-foreground/80 hover:border-gold hover:text-gold"}`}>
      {children}
    </button>
  );
}

export function Cover({ e, className }: { e: PublicEpisode; className: string }) {
  const src = coverUrl(e);
  return src
    ? <img src={src} alt="" loading="lazy" className={`${className} border-b border-border/60 object-cover`} />
    : <div className={`${className} flex items-center justify-center border-b border-border/60 bg-surface-deep`}><Headphones className="h-10 w-10 text-gold/60" /></div>;
}

function Meta({ e, catName }: { e: PublicEpisode; catName: (s: string) => string }) {
  const d = fmtDuration(e.duration_seconds);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
      <span className="text-gold">{catName(e.category)}</span>
      <span>{fmtDay(e.published_at)}</span>
      {d && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{d}</span>}
      <span className="inline-flex items-center gap-1">{e.access !== "public" && <Lock className="h-3 w-3" />}{EP_ACCESS[e.access]}</span>
    </div>
  );
}

const num = (e: PublicEpisode) => (e.episode_number ? `${String(e.episode_number).padStart(2, "0")}. ` : "");
