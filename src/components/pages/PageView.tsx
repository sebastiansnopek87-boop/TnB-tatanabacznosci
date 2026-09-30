import { Link } from "@tanstack/react-router";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import type { PageSection } from "@/lib/pages";

type Props = {
  eyebrow: string; title: string; intro: string; sections: PageSection[];
  imageSrc: (file: string) => string | undefined; preview?: boolean;
};

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => (
    <p key={i} className="mt-4 whitespace-pre-line text-[0.97rem] leading-[1.8] text-foreground/85 first:mt-0">{p}</p>
  ))}</>;
}

function Buttons({ s }: { s: PageSection }) {
  if (!s.buttons.length) return null;
  const cls = (i: number) => i === 0
    ? "inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright"
    : "inline-block border border-gold/60 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10";
  return (
    <div className="mt-7 flex flex-wrap gap-3">
      {s.buttons.map((b, i) => b.href.startsWith("/")
        ? <Link key={i} to={b.href as "/"} className={cls(i)}>{b.label}</Link>
        : <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" className={cls(i)}>{b.label}</a>)}
    </div>
  );
}

// One renderer for public pages and the admin preview, so both always look identical.
export function PageView({ eyebrow, title, intro, sections, imageSrc, preview }: Props) {
  return (
    <PageShell>
      {preview && <div className="bg-gold px-5 py-2 text-center text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground">Podgląd — ta wersja nie jest jeszcze widoczna publicznie</div>}
      <PageHeading eyebrow={eyebrow} title={title} intro={intro} />
      <div className="px-5 pb-20 lg:px-14">
        {sections.map((s) => {
          const src = s.image ? imageSrc(s.image) : undefined;
          if (s.kind === "quote") return (
            <section key={s.id} className="mx-auto max-w-3xl border-l-2 border-gold py-10 pl-6 lg:pl-10">
              <blockquote className="font-display text-[1.6rem] italic leading-snug text-foreground sm:text-[2rem]">„{s.body}”</blockquote>
              {s.quoteAuthor && <p className="eyebrow mt-4 text-gold">— {s.quoteAuthor}</p>}
              <Buttons s={s} />
            </section>
          );
          return (
            <section key={s.id} className="mx-auto max-w-3xl border-t border-border/60 py-12 first:border-t-0">
              {s.heading && <h2 className="font-display text-[1.7rem] font-semibold uppercase tracking-[0.03em] text-foreground sm:text-[2.1rem]">{s.heading}</h2>}
              {src && (
                <figure className="mt-6">
                  <img src={src} alt={s.imageAlt || s.heading || ""} loading="lazy" className="h-auto w-full border border-border/60 object-cover" />
                  {s.caption && <figcaption className="mt-2 text-xs text-muted-foreground">{s.caption}</figcaption>}
                </figure>
              )}
              {s.body && <div className="mt-6"><Paragraphs text={s.body} /></div>}
              <Buttons s={s} />
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
