import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Clock, ExternalLink, Headphones, Lock } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { AudioPlayer } from "@/components/podcast/AudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { getEpisode, getEpisodeMedia } from "@/lib/podcast.functions";
import { listCategories } from "@/lib/library";
import { EP_ACCESS, coverUrl, fmtDay, fmtDuration, type EpisodeDetail } from "@/lib/podcast";

export const Route = createFileRoute("/podcast/$slug")({
  loader: async ({ params }) => ({ episode: await getEpisode({ data: { slug: params.slug } }) }),
  head: ({ loaderData }) => {
    const e = loaderData?.episode;
    if (!e) return { meta: [{ title: "Odcinek niedostępny — Podcast TNB" }, { name: "robots", content: "noindex" }] };
    const t = `${e.title} — Podcast TNB`;
    const d = e.summary || "Odcinek podcastu Tata Na Baczności.";
    return { meta: [
      { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: e.has_cover ? "summary_large_image" : "summary" },
    ] };
  },
  component: EpisodePage,
});

const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function EpisodePage() {
  const { episode: e } = Route.useLoaderData();
  const cats = useQuery({ queryKey: ["library-categories"], queryFn: listCategories });
  if (!e) return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Nie znaleziono odcinka</h1>
        <p className="mt-4 text-sm text-foreground/70">Ten odcinek nie istnieje lub nie jest już dostępny.</p>
        <Link to="/podcast" className="mt-6 inline-block text-gold underline">Wróć do podcastu</Link>
      </div>
    </PageShell>
  );
  const cover = coverUrl(e);
  const d = fmtDuration(e.duration_seconds);
  return (
    <PageShell>
      <article className="mx-auto max-w-[900px] px-5 py-12 lg:py-16">
        <Link to="/podcast" className="text-xs uppercase tracking-[0.14em] text-foreground/60 hover:text-gold">← Wszystkie odcinki</Link>
        <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-end">
          {cover ? <img src={cover} alt="" className="aspect-square w-40 border border-border/60 object-cover sm:w-full" />
            : <div className="flex aspect-square w-40 items-center justify-center border border-border/60 bg-surface-deep sm:w-full"><Headphones className="h-10 w-10 text-gold/60" /></div>}
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="text-gold">{cats.data?.find((c) => c.slug === e.category)?.name ?? e.category}</span>
              <span>{fmtDay(e.published_at)}</span>
              {d && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{d}</span>}
              <span className="inline-flex items-center gap-1">{e.access !== "public" && <Lock className="h-3 w-3" />}{EP_ACCESS[e.access]}</span>
            </div>
            <h1 className="mt-3 break-words font-display text-[2rem] font-semibold uppercase leading-tight text-foreground sm:text-[2.6rem]">{e.title}</h1>
          </div>
        </div>
        <div className="mt-8"><Media e={e} /></div>
        {e.summary && <p className="mt-8 text-[1.05rem] leading-[1.75] text-foreground/90">{e.summary}</p>}
        <div className="mt-6 space-y-4 text-[0.95rem] leading-[1.8] text-foreground/80">
          {paras(e.description).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
        </div>
      </article>
    </PageShell>
  );
}

function Media({ e }: { e: EpisodeDetail }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const m = useQuery({
    queryKey: ["podcast-media", e.id, uid], enabled: uid !== undefined,
    queryFn: () => getEpisodeMedia({ data: { id: e.id } }), staleTime: 60 * 60 * 1000,
  });

  if (!m.data) return <div className="border border-border/60 bg-surface-deep p-5 text-sm text-muted-foreground">{m.error ? "Nie udało się wczytać nagrania." : "Wczytywanie nagrania…"}</div>;
  if (!m.data.allowed) {
    const back = `/podcast/${e.slug}`;
    return (
      <div className="border border-gold/40 bg-surface-deep p-6">
        <p className="flex items-center gap-2 text-gold"><Lock className="h-4 w-4" /><span className="eyebrow">{m.data.reason === "login" && e.access === "members" ? "Dla zalogowanych" : "Premium"}</span></p>
        {m.data.reason === "login" ? (
          <>
            <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">
              {e.access === "members"
                ? "Ten odcinek jest dostępny dla członków społeczności TNB. Zaloguj się lub dołącz do nas, aby go wysłuchać."
                : "To odcinek premium. Zaloguj się na konto z dostępem do materiałów premium, aby go wysłuchać."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/auth" search={{ powrot: back }} className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Zaloguj się</Link>
              <Link to="/auth" search={{ tryb: "rejestracja", powrot: back }} className="border border-gold/60 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10">Dołącz do TNB</Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">
              To odcinek premium. Twoje konto nie ma jeszcze dostępu do materiałów premium. Napisz do nas, a wyjaśnimy, jak go uzyskać.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/materialy-premium" className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Materiały premium</Link>
              <Link to="/kontakt" className="border border-gold/60 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10">Kontakt</Link>
            </div>
          </>
        )}
      </div>
    );
  }
  const { src, external } = m.data;
  return (
    <div className="space-y-4">
      {src && <AudioPlayer src={src} title={e.title} />}
      {!src && external && /\.(mp3|m4a|aac|ogg|wav|webm)(\?|$)/i.test(external) && <AudioPlayer src={external} title={e.title} />}
      {external && (
        <a href={external} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 border border-gold/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10">
          <ExternalLink className="h-4 w-4" /> Posłuchaj w serwisie zewnętrznym
        </a>
      )}
    </div>
  );
}
