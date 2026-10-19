import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock, Headphones, Lock } from "lucide-react";
import { EP_ACCESS, coverUrl, fmtDuration, type PublicEpisode } from "@/lib/podcast";
import { episodeNavigation } from "@/lib/podcast-navigation";

export function EpisodeNavigation({ current, episodes, unavailable }: { current: PublicEpisode; episodes: PublicEpisode[]; unavailable: boolean }) {
  const { previous, next, related } = episodeNavigation(current, episodes);
  return (
    <section aria-labelledby="listen-also" className="mt-12 border-t border-border/60 pt-8">
      <h2 id="listen-also" className="font-display text-2xl font-semibold uppercase text-foreground">Posłuchaj również</h2>
      {unavailable ? <p role="status" className="mt-4 text-sm text-muted-foreground">Nie udało się wczytać pozostałych odcinków. Spróbuj odświeżyć stronę.</p> : <>
        {previous || next ? <nav aria-label="Nawigacja między odcinkami" className="mt-6 grid gap-4 sm:grid-cols-2">
          {previous ? <EpisodeLink episode={previous} direction="previous" /> : <p className="py-4 text-sm text-muted-foreground">To pierwszy odcinek.</p>}
          {next ? <EpisodeLink episode={next} direction="next" /> : <p className="py-4 text-sm text-muted-foreground sm:text-right">To ostatni odcinek.</p>}
        </nav> : null}
        {related.length > 0 && <div className="mt-6 grid gap-4 sm:grid-cols-2">{related.map((e) => <EpisodeLink key={e.id} episode={e} />)}</div>}
        {!previous && !next && !related.length && <p className="mt-4 text-sm text-muted-foreground">Nie ma jeszcze innych opublikowanych odcinków.</p>}
      </>}
    </section>
  );
}

function EpisodeLink({ episode: e, direction }: { episode: PublicEpisode; direction?: "previous" | "next" }) {
  const cover = coverUrl(e);
  const duration = fmtDuration(e.duration_seconds);
  return (
    <Link to="/podcast/$slug" params={{ slug: e.slug }} className="group flex min-w-0 gap-4 rounded-sm border border-border/60 bg-card p-4 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-gold">
      <span className="h-20 w-20 shrink-0 overflow-hidden bg-surface-deep">
        {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Headphones className="h-6 w-6 text-gold/60" /></span>}
      </span>
      <span className="min-w-0">
        {direction && <span className="mb-2 flex items-center gap-2 text-xs uppercase text-gold">{direction === "previous" ? <><ArrowLeft className="h-3 w-3" />Poprzedni odcinek</> : <>Następny odcinek<ArrowRight className="h-3 w-3" /></>}</span>}
        <span className="block break-words font-display text-base font-semibold uppercase leading-snug text-foreground group-hover:text-gold">{e.episode_number != null && <span>{String(e.episode_number).padStart(2, "0")}. </span>}{e.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {duration && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>}
          <span className="inline-flex items-center gap-1">{e.access !== "public" && <Lock className="h-3 w-3" />}{EP_ACCESS[e.access]}</span>
        </span>
      </span>
    </Link>
  );
}