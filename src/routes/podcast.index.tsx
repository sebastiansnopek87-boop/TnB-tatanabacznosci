import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Headphones, Lock, Search } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { ChannelsSection, InstagramSection, StorySection, WatchSection } from "@/components/voice/VoiceSections";
import { listEpisodes } from "@/lib/podcast.functions";
import { coverUrl, fmtDay, fmtDuration, type PublicEpisode } from "@/lib/podcast";
import { getPodcastLayout } from "@/lib/platform.functions";
import { listInstagram, listVideos } from "@/lib/voice.functions";
import { buildMedia, SOURCE_LABEL, type MediaItem, type MediaSource } from "@/lib/voice-media";

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

const ORDER: MediaSource[] = ["podcast", "youtube", "manual", "instagram"];

function PodcastPage() {
  const eps = useQuery({ queryKey: ["podcast"], queryFn: () => listEpisodes() });
  const vids = useQuery({ queryKey: ["voice-videos"], queryFn: () => listVideos() });
  const ig = useQuery({ queryKey: ["voice-instagram"], queryFn: () => listInstagram(), staleTime: 300_000 });
  const layout = useQuery({ queryKey: ["podcast-layout"], queryFn: () => getPodcastLayout() });
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<MediaSource | null>(null);
  const [video, setVideo] = useState<{ id: string; n: number } | null>(null);

  const all = useMemo(() => buildMedia(eps.data ?? [], vids.data ?? [], ig.data?.connected ? ig.data.items : []), [eps.data, vids.data, ig.data]);
  const sources = ORDER.filter((s) => all.some((m) => m.source === s)); // only real, non-empty sources get a filter
  const latest = all[0];
  const filtering = q.trim().length > 0 || !!src;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((m) => (filtering || m.key !== latest?.key) && (!src || m.source === src)
      && (!s || m.title.toLowerCase().includes(s) || m.summary.toLowerCase().includes(s)));
  }, [all, q, src, filtering, latest?.key]);
  const loading = eps.isLoading || vids.isLoading;
  const watch = (id: string) => { setVideo((v) => ({ id, n: (v?.n ?? 0) + 1 })); requestAnimationFrame(() => document.getElementById("ogladaj")?.scrollIntoView({ behavior: "smooth", block: "start" })); };

  return (
    <PageShell>
      <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
        <h1 className="font-display text-[2.6rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.4rem]">Głos TNB</h1>
        <p className="mt-5 max-w-2xl text-[1.1rem] italic text-foreground/85">Historie, rozmowy i głosy ludzi, którzy są w drodze.</p>
      </section>

      <div className="px-5 py-12 lg:px-14">
        {loading ? <p className="text-sm text-muted-foreground">Ładowanie materiałów…</p>
          : eps.error && vids.error ? <p className="text-sm text-destructive">Nie udało się pobrać materiałów. Odśwież stronę.</p>
          : !all.length ? (
            <div className="max-w-2xl border border-gold/40 bg-surface-deep p-8">
              <Headphones className="h-6 w-6 text-gold" />
              <p className="mt-4 font-display text-2xl font-semibold uppercase text-foreground">Brak opublikowanych materiałów</p>
              <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/80">Pierwsze nagrania są w przygotowaniu. Zajrzyj tu wkrótce.</p>
            </div>
          ) : (<>
            {latest && !filtering && (
              <section aria-labelledby="latest">
                <p id="latest" className="eyebrow text-gold">Najnowszy materiał</p>
                <Card m={latest} big onWatch={watch} />
              </section>
            )}

            <section className={latest && !filtering ? "mt-14" : ""} aria-labelledby="all-media">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 id="all-media" className="font-display text-2xl font-semibold uppercase text-foreground">{filtering ? "Wyniki" : "Wszystkie materiały"}</h2>
                <label className="relative block w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj materiału…" aria-label="Szukaj materiału"
                    className="w-full border border-border bg-surface-deep py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none" />
                </label>
              </div>
              {sources.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtruj według źródła">
                  <Chip active={!src} onClick={() => setSrc(null)}>Wszystkie</Chip>
                  {sources.map((s) => <Chip key={s} active={src === s} onClick={() => setSrc(s)}>{SOURCE_LABEL[s]}</Chip>)}
                </div>
              )}
              {!list.length ? (
                <p className="mt-8 border border-border/60 p-6 text-sm text-muted-foreground">{filtering ? "Brak materiałów pasujących do wyszukiwania." : "To na razie jedyny opublikowany materiał."}</p>
              ) : layout.data === "grid" ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((m) => <Card key={m.key} m={m} grid onWatch={watch} />)}</div>
              ) : (
                <div className="mt-8 flex flex-col gap-3">{list.map((m) => <Card key={m.key} m={m} onWatch={watch} />)}</div>
              )}
            </section>
          </>)}
      </div>

      <WatchSection selected={video?.id ?? null} {...(video?.n !== undefined ? { autoplay: video.n } : {})} />
      <InstagramSection />
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

function Card({ m, big, grid, onWatch }: { m: MediaItem; big?: boolean; grid?: boolean; onWatch: (id: string) => void }) {
  const d = fmtDuration(m.duration);
  const thumb = m.thumb
    ? <img src={m.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
    : <span className="flex h-full w-full items-center justify-center bg-surface-deep"><Headphones className="h-8 w-8 text-gold/60" /></span>;
  const body = (
    <>
      <span className={`block shrink-0 overflow-hidden border border-border/60 ${big ? "aspect-video w-full sm:w-[320px]" : grid ? "aspect-video w-full border-0 border-b" : "aspect-video w-28 sm:w-44"}`}>{thumb}</span>
      <span className={`flex min-w-0 flex-1 flex-col ${grid ? "p-4" : ""}`}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="text-gold">{SOURCE_LABEL[m.source]}</span>
          {m.date && <span>{fmtDay(m.date)}</span>}
          {d && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{d}</span>}
          {m.locked && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Dostęp ograniczony</span>}
        </span>
        <span className={`mt-1.5 break-words font-display font-semibold uppercase leading-snug text-foreground group-hover:text-gold ${big ? "text-xl lg:text-2xl" : "text-base"}`}>{m.title}</span>
        {m.summary && <span className={`mt-1 text-[0.85rem] leading-relaxed text-foreground/75 ${big ? "line-clamp-4" : grid ? "line-clamp-2" : "hidden sm:line-clamp-2"}`}>{m.summary}</span>}
        <span className={`${grid ? "mt-auto pt-3" : "mt-3"} text-[0.72rem] uppercase tracking-[0.14em] text-gold`}>{m.cta} {m.action.kind === "external" ? "↗" : "→"}</span>
      </span>
    </>
  );
  const cls = `group flex border border-border/60 bg-card text-left hover:border-gold/60 ${grid ? "flex-col" : big ? "mt-4 flex-col gap-5 p-4 sm:flex-row lg:p-5" : "items-start gap-4 p-3 sm:p-4"}`;
  if (m.action.kind === "episode") return <Link to="/podcast/$slug" params={{ slug: m.action.slug }} className={cls}>{body}</Link>;
  if (m.action.kind === "external") return <a href={m.action.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  const id = m.action.id;
  return <button type="button" onClick={() => onWatch(id)} className={`${cls} w-full`}>{body}</button>;
}

// kept for existing importers (episode detail page)
export function Cover({ e, className }: { e: PublicEpisode; className: string }) {
  const src = coverUrl(e);
  return src
    ? <img src={src} alt="" loading="lazy" className={`${className} border-b border-border/60 object-cover`} />
    : <div className={`${className} flex items-center justify-center border-b border-border/60 bg-surface-deep`}><Headphones className="h-10 w-10 text-gold/60" /></div>;
}
