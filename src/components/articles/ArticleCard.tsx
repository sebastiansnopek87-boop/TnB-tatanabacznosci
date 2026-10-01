import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { articleImageUrl, fmtArticleDate, minutesLabel, type ArticleCard as Card } from "@/lib/articles";

export function ArticleCard({ a, category }: { a: Card; category?: string | undefined }) {
  return (
    <article className="group flex min-w-0 flex-col border border-border/60 bg-card/40 transition-colors hover:border-gold/50">
      <Link to="/artykuly/$slug" params={{ slug: a.slug }} className="block aspect-[16/10] overflow-hidden bg-surface-deep" tabIndex={-1} aria-hidden>
        {a.cover
          ? <img src={articleImageUrl(a.id, a.cover, a.updated_at)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <div className="flex h-full items-center justify-center font-display text-4xl text-gold/40">TNB</div>}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        {category && <p className="eyebrow text-gold">{category}</p>}
        <h3 className="mt-3 font-display text-[1.55rem] font-semibold leading-[1.15] text-foreground">
          <Link to="/artykuly/$slug" params={{ slug: a.slug }} className="hover:text-gold">{a.title}</Link>
        </h3>
        {a.excerpt && <p className="mt-3 line-clamp-3 text-[0.9rem] leading-[1.7] text-foreground/75">{a.excerpt}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{a.author_name}</span><span aria-hidden>·</span><span>{fmtArticleDate(a.published_at)}</span><span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{minutesLabel(a.reading_minutes)}</span>
        </p>
        <Link to="/artykuly/$slug" params={{ slug: a.slug }} className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-gold hover:text-gold-bright">
          Czytaj artykuł <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
