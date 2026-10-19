import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart, MessageSquare } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { articleCategoriesQuery, homeArticlesQuery } from "@/lib/articles";
import { SECTORS, listPosts, useUid } from "@/lib/community";
import { legacySection } from "@/lib/home-legacy";
import { usePreviewAudience } from "@/lib/preview-audience";
import type { PageSection } from "@/lib/pages";
import { Txt, editAttrs, type BlockProps } from "./home-edit";

const btn = "inline-flex items-center gap-3 border border-gold/70 px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/10";
const fmt = (s: string) => new Date(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

function Heading({ s, a }: { s: PageSection; a: ReturnType<typeof editAttrs> }) {
  return (
    <div className="max-w-2xl">
      {s.eyebrow && <p {...a("eyebrow")} className="eyebrow text-gold"><Txt s={s} k="eyebrow" text={s.eyebrow} /></p>}
      <h2 {...a("heading")} className="mt-3 font-display text-[2.4rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3rem]"><Txt s={s} k="heading" text={s.heading} /></h2>
      {s.body && <p {...a("body")} className="mt-4 text-[0.98rem] leading-[1.75] text-foreground/80"><Txt s={s} k="body" text={s.body} /></p>}
    </div>
  );
}
function MainButton({ s, i, a, edit }: { s: PageSection; i: number; a: ReturnType<typeof editAttrs>; edit: boolean }) {
  const b = s.buttons[i];
  if (!b || (b.hidden && !edit)) return null;
  return <div className={`mt-10 ${b.hidden ? "opacity-40" : ""}`}><a {...a(`button-${i}`)} href={b.href} className={btn}><Txt s={s} k={`button-${i}`} text={b.label} />{b.icon !== "none" && <ArrowRight className="h-4 w-4" />}</a></div>;
}

export function HomeArticles({ s = legacySection("home-articles"), sel }: BlockProps) {
  const a = editAttrs(sel);
  const arts = useQuery(homeArticlesQuery());
  const cats = useQuery(articleCategoriesQuery());
  const name = (c: string | null) => cats.data?.find((x) => x.slug === c)?.name;
  return (
    <section aria-labelledby="home-articles" className="border-b border-border/60 px-5 py-16 lg:px-14 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div id="home-articles"><Heading s={s} a={a} /></div>
        {arts.isLoading && <p className="mt-10 text-sm text-muted-foreground">Wczytywanie artykułów…</p>}
        {arts.error && <p className="mt-10 text-sm text-destructive">Nie udało się wczytać artykułów.</p>}
        {arts.data && arts.data.length === 0 && (
          <p {...a("caption")} className="mt-10 border border-dashed border-gold/40 px-6 py-12 text-center text-[0.95rem] leading-[1.75] text-foreground/80"><Txt s={s} k="caption" text={s.caption} /></p>
        )}
        {arts.data && arts.data.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {arts.data.map((x) => <ArticleCard key={x.id} a={x} category={name(x.category)} />)}
          </div>
        )}
        <MainButton s={s} i={0} a={a} edit={sel !== undefined} />
      </div>
    </section>
  );
}

type Row = { id: string; author_name: string; created_at: string; sector: string | null; body: string; comments: number; reactions: number };
// Builder preview never loads the admin's real feed: clearly labelled sample rows instead.
const SAMPLE: Row[] = [
  { id: "p1", author_name: "Przykładowy autor", created_at: "2026-10-01T10:00:00Z", sector: null, body: "Przykładowa rozmowa — w podglądzie edytora nie pokazujemy prawdziwych wpisów członków.", comments: 3, reactions: 5 },
  { id: "p2", author_name: "Przykładowy autor", created_at: "2026-09-28T10:00:00Z", sector: null, body: "Tu pojawi się najnowsza rozmowa społeczności.", comments: 1, reactions: 2 },
  { id: "p3", author_name: "Przykładowy autor", created_at: "2026-09-20T10:00:00Z", sector: null, body: "Lista wypełnia się automatycznie z modułu Rozmowy.", comments: 0, reactions: 1 },
];

export function HomeConversations({ s = legacySection("home-talks"), sel }: BlockProps) {
  const a = editAttrs(sel);
  const edit = sel !== undefined;
  const preview = usePreviewAudience();
  const { uid, ready: realReady } = useUid();
  const signedIn = preview ? preview === "member" : !!uid;
  const ready = preview ? true : realReady;
  // Same feed as the community page, newest first — public posts only for guests (RLS).
  const posts = useQuery({ queryKey: ["community", "home", uid], queryFn: () => listPosts(0, false, signedIn, "newest"), enabled: ready && !preview, select: (r) => r.slice(0, 3) });
  const rows: Row[] | undefined = preview ? SAMPLE : posts.data;
  const box = s.items[0];
  const start = s.buttons[1];
  return (
    <section aria-labelledby="home-talks" className="border-b border-border/60 bg-surface-deep px-5 py-16 lg:px-14 lg:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div id="home-talks"><Heading s={s} a={a} /></div>
        {preview && <p className="mt-6 inline-block border border-gold/50 px-3 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-gold">Przykładowe dane podglądu</p>}
        {!preview && (!ready || posts.isLoading) && <p className="mt-10 text-sm text-muted-foreground">Wczytywanie rozmów…</p>}
        {!preview && posts.error && <p className="mt-10 text-sm text-destructive">Nie udało się wczytać rozmów.</p>}
        {rows && rows.length === 0 && (
          <p className="mt-10 border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
            {signedIn ? "Nie ma jeszcze żadnych rozmów. Zacznij pierwszą." : "Nie ma jeszcze publicznych rozmów. Dołącz, aby czytać rozmowy społeczności."}
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {rows.map((p) => (
              <article key={p.id} className="flex min-w-0 flex-col border border-border/60 bg-background/60 p-6">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{p.author_name}</span><span aria-hidden>·</span><span>{fmt(p.created_at)}</span>
                </p>
                {p.sector && <p className="eyebrow mt-3 text-gold">{SECTORS[p.sector as keyof typeof SECTORS] ?? p.sector}</p>}
                <p className="mt-3 line-clamp-5 whitespace-pre-line break-words text-[0.93rem] leading-[1.7] text-foreground/85">{p.body}</p>
                <p className="mt-5 flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5" title="Komentarze"><MessageSquare className="h-3.5 w-3.5" />{p.comments} {p.comments === 1 ? "komentarz" : "komentarzy"}</span>
                  <span className="inline-flex items-center gap-1.5" title="Reakcje"><Heart className="h-3.5 w-3.5" />{p.reactions}</span>
                </p>
                {preview ? <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-gold">Dołącz do rozmowy <ArrowRight className="h-4 w-4" /></span>
                  : <Link to="/spolecznosc/$postId" params={{ postId: p.id }} className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-gold hover:text-gold-bright">Dołącz do rozmowy <ArrowRight className="h-4 w-4" /></Link>}
              </article>
            ))}
          </div>
        )}
        <MainButton s={s} i={0} a={a} edit={edit} />

        {box && (edit || !box.hidden) && <div {...a("item-0")} className={`mt-14 flex flex-col items-start justify-between gap-6 border border-gold/30 bg-card/50 px-6 py-8 sm:flex-row sm:items-center sm:px-10 ${box.hidden ? "opacity-40" : ""}`}>
          <div className="max-w-xl">
            <p className="font-display text-[1.6rem] leading-snug text-foreground"><Txt s={s} k="item-0-title" text={box.title} /></p>
            {ready && !signedIn && box.body && <p className="mt-2 text-sm text-muted-foreground"><Txt s={s} k="item-0-body" text={box.body} /></p>}
          </div>
          {start && (edit || !start.hidden) && <a {...a("button-1")} href={signedIn ? start.href : "/auth?tryb=rejestracja"} className="shrink-0 bg-gold px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-primary-foreground hover:bg-gold-bright"><Txt s={s} k="button-1" text={start.label} /></a>}
        </div>}
      </div>
    </section>
  );
}
