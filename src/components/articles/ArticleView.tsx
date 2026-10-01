import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/tnb/PageShell";
import { PageSections } from "@/components/pages/PageView";
import { Button } from "@/components/ui/button";
import { fmtArticleDate, minutesLabel } from "@/lib/articles";
import type { PageSection } from "@/lib/pages";

type Props = {
  title: string; excerpt: string; category: string | null; author: string; publishedAt: string | null; minutes: number;
  cover: string | undefined; coverAlt: string; sections: PageSection[]; imageSrc: (f: string) => string | undefined; preview?: boolean; after?: ReactNode;
};

async function share(title: string) {
  const url = window.location.href;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast.success("Skopiowano link do artykułu.");
  } catch { /* user closed the share sheet */ }
}

// One renderer for the public article and the admin preview, so both look identical.
export function ArticleView(p: Props) {
  return (
    <PageShell>
      {p.preview && <div className="bg-gold px-5 py-2 text-center text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground">Podgląd — ta wersja nie jest jeszcze widoczna publicznie</div>}
      <article className="overflow-x-hidden">
        <header className="border-b border-border/60 px-5 pb-10 pt-10 lg:px-14 lg:pt-14">
          <div className="mx-auto max-w-3xl">
            <Link to="/artykuly" className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Wszystkie artykuły
            </Link>
            {p.category && <p className="eyebrow mt-8 text-gold">{p.category}</p>}
            <h1 className="mt-4 font-display text-[2.3rem] font-semibold leading-[1.08] text-foreground sm:text-[3.2rem]">{p.title}</h1>
            {p.excerpt && <p className="mt-6 text-[1.08rem] leading-[1.75] text-foreground/80">{p.excerpt}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="text-foreground">{p.author}</span><span aria-hidden>·</span>
                <span>{p.publishedAt ? fmtArticleDate(p.publishedAt) : "Data publikacji nieustawiona"}</span><span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{minutesLabel(p.minutes)}</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => share(p.title)}><Share2 className="mr-2 h-4 w-4" />Udostępnij</Button>
            </div>
          </div>
        </header>
        {p.cover && (
          <figure className="mx-auto max-w-5xl px-5 pt-10 lg:px-14">
            <img src={p.cover} alt={p.coverAlt || p.title} className="aspect-[16/9] w-full border border-border/60 object-cover" />
          </figure>
        )}
        <PageSections sections={p.sections} imageSrc={p.imageSrc} />
        {p.after}
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 border-t border-border/60 px-5 py-10 lg:px-0">
          <Link to="/artykuly" className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-gold hover:text-gold-bright">
            <ArrowLeft className="h-4 w-4" /> Wróć do listy artykułów
          </Link>
          <Link to="/spolecznosc" className="text-sm text-muted-foreground hover:text-gold">Chcesz o tym porozmawiać? Przejdź do rozmów społeczności →</Link>
        </div>
      </article>
    </PageShell>
  );
}
