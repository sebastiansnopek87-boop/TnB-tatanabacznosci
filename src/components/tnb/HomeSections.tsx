import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart, MessageSquare } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { articleCategoriesQuery, homeArticlesQuery } from "@/lib/articles";
import { SECTORS, listPosts, useUid } from "@/lib/community";

const btn = "inline-flex items-center gap-3 border border-gold/70 px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/10";
const fmt = (s: string) => new Date(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

function Heading({ title, sub, eyebrow }: { title: string; sub: string; eyebrow: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[2.4rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3rem]">{title}</h2>
      <p className="mt-4 text-[0.98rem] leading-[1.75] text-foreground/80">{sub}</p>
    </div>
  );
}

export function HomeArticles() {
  const arts = useQuery(homeArticlesQuery());
  const cats = useQuery(articleCategoriesQuery());
  const name = (s: string | null) => cats.data?.find((c) => c.slug === s)?.name;
  return (
    <section aria-labelledby="home-articles" className="border-b border-border/60 px-5 py-16 lg:px-14 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div id="home-articles"><Heading eyebrow="Teksty redakcyjne" title="Artykuły" sub="Myśli, doświadczenia i historie, którymi chcę się z Wami podzielić." /></div>
        {arts.isLoading && <p className="mt-10 text-sm text-muted-foreground">Wczytywanie artykułów…</p>}
        {arts.error && <p className="mt-10 text-sm text-destructive">Nie udało się wczytać artykułów.</p>}
        {arts.data && arts.data.length === 0 && (
          <p className="mt-10 border border-dashed border-gold/40 px-6 py-12 text-center text-[0.95rem] leading-[1.75] text-foreground/80">
            Przygotowuję pierwsze artykuły. Zajrzyj tu wkrótce.
          </p>
        )}
        {arts.data && arts.data.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {arts.data.map((a) => <ArticleCard key={a.id} a={a} category={name(a.category)} />)}
          </div>
        )}
        <div className="mt-10"><Link to="/artykuly" className={btn}>Zobacz wszystkie artykuły <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
  );
}

export function HomeConversations() {
  const { uid, ready } = useUid();
  const signedIn = !!uid;
  // Same feed as the community page, newest first — public posts only for guests (RLS).
  const posts = useQuery({ queryKey: ["community", "home", uid], queryFn: () => listPosts(0, false, signedIn, "newest"), enabled: ready, select: (r) => r.slice(0, 3) });
  return (
    <section aria-labelledby="home-talks" className="border-b border-border/60 bg-surface-deep px-5 py-16 lg:px-14 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div id="home-talks"><Heading eyebrow="Tworzone przez członków społeczności" title="Rozmowy społeczności" sub="Tutaj każdy może zabrać głos. Dzielimy się doświadczeniem, pytamy i słuchamy." /></div>
        {(!ready || posts.isLoading) && <p className="mt-10 text-sm text-muted-foreground">Wczytywanie rozmów…</p>}
        {posts.error && <p className="mt-10 text-sm text-destructive">Nie udało się wczytać rozmów.</p>}
        {posts.data && posts.data.length === 0 && (
          <p className="mt-10 border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
            {signedIn ? "Nie ma jeszcze żadnych rozmów. Zacznij pierwszą." : "Nie ma jeszcze publicznych rozmów. Dołącz, aby czytać rozmowy społeczności."}
          </p>
        )}
        {posts.data && posts.data.length > 0 && (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {posts.data.map((p) => (
              <article key={p.id} className="flex min-w-0 flex-col border border-border/60 bg-background/60 p-6">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{p.author_name}</span><span aria-hidden>·</span><span>{fmt(p.created_at)}</span>
                </p>
                {p.sector && <p className="eyebrow mt-3 text-gold">{SECTORS[p.sector] ?? p.sector}</p>}
                <p className="mt-3 line-clamp-5 whitespace-pre-line break-words text-[0.93rem] leading-[1.7] text-foreground/85">{p.body}</p>
                <p className="mt-5 flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5" title="Komentarze"><MessageSquare className="h-3.5 w-3.5" />{p.comments} {p.comments === 1 ? "komentarz" : "komentarzy"}</span>
                  <span className="inline-flex items-center gap-1.5" title="Reakcje"><Heart className="h-3.5 w-3.5" />{p.reactions}</span>
                </p>
                <Link to="/spolecznosc/$postId" params={{ postId: p.id }} className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-gold hover:text-gold-bright">
                  Dołącz do rozmowy <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        )}
        <div className="mt-10"><Link to="/spolecznosc" className={btn}>Przejdź do rozmów <ArrowRight className="h-4 w-4" /></Link></div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border border-gold/30 bg-card/50 px-6 py-8 sm:flex-row sm:items-center sm:px-10">
          <div className="max-w-xl">
            <p className="font-display text-[1.6rem] leading-snug text-foreground">Masz coś, czym chcesz się podzielić? Twoje doświadczenie może być ważne dla kogoś innego.</p>
            {ready && !signedIn && <p className="mt-2 text-sm text-muted-foreground">Publikowanie rozmów wymaga bezpłatnego konta TNB.</p>}
          </div>
          {signedIn
            ? <Link to="/spolecznosc" hash="new-post" className="shrink-0 bg-gold px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-primary-foreground hover:bg-gold-bright">Rozpocznij rozmowę</Link>
            : <Link to="/auth" search={{ tryb: "rejestracja" }} className="shrink-0 bg-gold px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-primary-foreground hover:bg-gold-bright">Rozpocznij rozmowę</Link>}
        </div>
      </div>
    </section>
  );
}
