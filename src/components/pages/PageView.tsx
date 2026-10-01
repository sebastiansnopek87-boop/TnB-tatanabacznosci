import { Link } from "@tanstack/react-router";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { normalizeSections, type PageSection } from "@/lib/pages";

type Props = {
  eyebrow: string; title: string; intro: string; sections: PageSection[];
  imageSrc: (file: string) => string | undefined; preview?: boolean;
};

function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  return <>{text.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => (
    <p key={i} className={`mt-5 whitespace-pre-line text-[0.98rem] leading-[1.85] text-foreground/80 first:mt-0 ${className}`}>{p}</p>
  ))}</>;
}

function Buttons({ s, center }: { s: PageSection; center?: boolean }) {
  if (!s.buttons.length) return null;
  const cls = (i: number) => i === 0
    ? "inline-block bg-gold px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright"
    : i === 1
      ? "inline-block border border-gold/60 px-7 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/10"
      : "inline-block px-2 py-3.5 text-[0.72rem] uppercase tracking-[0.16em] text-foreground/75 underline-offset-4 hover:text-gold hover:underline";
  return (
    <div className={`mt-9 flex flex-wrap items-center gap-3 ${center ? "justify-center" : ""}`}>
      {s.buttons.map((b, i) => b.href.startsWith("/") && !b.href.includes("?")
        ? <Link key={i} to={b.href as "/"} className={cls(i)}>{b.label}</Link>
        : b.href.startsWith("/")
          ? <a key={i} href={b.href} className={cls(i)}>{b.label}</a>
          : <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" className={cls(i)}>{b.label}</a>)}
    </div>
  );
}

const Eyebrow = ({ t }: { t: string }) => t ? <p className="eyebrow text-gold">{t}</p> : null;
const H2 = ({ t }: { t: string }) => t
  ? <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] text-foreground first:mt-0 sm:text-[2.6rem]">{t}</h2>
  : null;

function Img({ s, src, className, eager }: { s: PageSection; src: string; className: string; eager?: boolean }) {
  return (
    <figure className="min-w-0">
      <img src={src} alt={s.decorative ? "" : s.imageAlt || s.heading || ""} aria-hidden={s.decorative || undefined} loading={eager ? "eager" : "lazy"} decoding="async" className={`w-full object-cover ${className}`} />
      {s.caption && <figcaption className="mt-3 text-xs tracking-wide text-muted-foreground">{s.caption}</figcaption>}
    </figure>
  );
}

function Section({ s, src, first }: { s: PageSection; src?: string | undefined; first: boolean }) {
  const imgLeft = s.layout === "left";
  switch (s.kind) {
    case "hero":
      return (
        <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-24">
          <div className={`mx-auto grid max-w-6xl items-center gap-10 ${src ? "lg:grid-cols-[1.1fr_1fr] lg:gap-16" : ""}`}>
            <div className={`min-w-0 ${src && imgLeft ? "lg:order-2" : ""}`}>
              <Eyebrow t={s.eyebrow} />
              {s.heading && <h1 className="mt-5 font-display text-[2.3rem] font-semibold leading-[1.08] text-foreground sm:text-[3.2rem] lg:text-[3.6rem]">{s.heading}</h1>}
              {s.body && <div className="mt-8 max-w-xl"><Paragraphs text={s.body} /></div>}
              <Buttons s={s} />
            </div>
            {src && <Img s={s} src={src} eager className="aspect-[4/5] max-h-[640px] border border-border/60 sm:aspect-[4/3] lg:aspect-[4/5]" />}
          </div>
        </section>
      );
    case "values":
      return (
        <section className="border-t border-border/60 bg-card/40 px-5 py-16 lg:px-14 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl"><Eyebrow t={s.eyebrow} /><H2 t={s.heading} />{s.body && <div className="mt-6"><Paragraphs text={s.body} /></div>}</div>
            <div className="mt-12 grid gap-px border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, i) => (
                <div key={i} className="bg-background p-7 lg:p-9">
                  <span className="font-display text-sm text-gold/70">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-[0.8rem] font-medium uppercase tracking-[0.18em] text-gold">{it.title}</h3>
                  <p className="mt-4 text-[0.93rem] leading-[1.75] text-foreground/75">{it.body}</p>
                </div>
              ))}
            </div>
            <Buttons s={s} />
          </div>
        </section>
      );
    case "columns":
      return (
        <section className="border-t border-border/60 px-5 py-16 lg:px-14 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="max-w-3xl"><Eyebrow t={s.eyebrow} /><H2 t={s.heading} />{s.body && <div className="mt-6"><Paragraphs text={s.body} /></div>}</div>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {s.items.map((it, i) => (
                <div key={i} className={`border p-7 lg:p-9 ${i === 0 ? "border-gold/50" : "border-border/60"}`}>
                  <h3 className={`text-[0.8rem] font-medium uppercase tracking-[0.18em] ${i === 0 ? "text-gold" : "text-muted-foreground"}`}>{it.title}</h3>
                  <ul className="mt-6 space-y-4">
                    {it.body.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean).map((l, k) => (
                      <li key={k} className="flex gap-3 text-[0.95rem] leading-[1.65] text-foreground/80">
                        <span aria-hidden className={`mt-[0.6rem] h-px w-4 shrink-0 ${i === 0 ? "bg-gold" : "bg-muted-foreground/60"}`} />{l}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Buttons s={s} />
          </div>
        </section>
      );
    case "quote":
      return (
        <section className="relative overflow-hidden border-t border-border/60">
          {src && <img src={src} alt={s.imageAlt || ""} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
          {src && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />}
          <div className={`relative mx-auto max-w-4xl px-5 text-center lg:px-14 ${src ? "py-28 lg:py-40" : "py-16 lg:py-24"}`}>
            <span aria-hidden className="mx-auto block h-10 w-px bg-gold" />
            <blockquote className="mt-8 font-display text-[1.8rem] italic leading-snug text-foreground sm:text-[2.5rem]">„{s.body}”</blockquote>
            {s.quoteAuthor && <p className="eyebrow mt-8 text-gold">{s.quoteAuthor}</p>}
            <Buttons s={s} center />
          </div>
        </section>
      );
    case "image": {
      const alt = s.decorative ? "" : s.imageAlt || s.heading || "";
      const text = (s.heading || s.body || s.buttons.length > 0) && <div className="mt-6"><H2 t={s.heading} />{s.body && <div className="mt-6"><Paragraphs text={s.body} /></div>}<Buttons s={s} /></div>;
      if (s.display === "inset" || s.display === "featured") {
        const featured = s.display === "featured";
        return (
          <section className="px-5 py-10 lg:px-14 lg:py-14">
            <figure className={`mx-auto min-w-0 ${featured ? "max-w-4xl border border-gold/40 bg-card/50 p-3 sm:p-5" : "max-w-3xl"}`}>
              {src && <img src={src} alt={alt} aria-hidden={s.decorative || undefined} loading="lazy" decoding="async" className="aspect-[3/2] w-full object-cover" />}
              {s.caption && <figcaption className={featured ? "mt-4 border-l-2 border-gold pl-4 font-display text-[1.25rem] italic leading-snug text-foreground/90" : "mt-3 text-xs tracking-wide text-muted-foreground"}>{s.caption}</figcaption>}
            </figure>
            {text && <div className="mx-auto max-w-3xl">{text}</div>}
          </section>
        );
      }
      return (
        <section className="border-t border-border/60">
          {src && <figure className="m-0"><img src={src} alt={alt} aria-hidden={s.decorative || undefined} loading="lazy" decoding="async" className="h-[42vh] min-h-[260px] w-full object-cover lg:h-[62vh]" />
            {s.caption && <figcaption className="mx-auto max-w-3xl px-5 pt-4 text-center font-display text-[1.15rem] italic text-foreground/80 lg:px-0">{s.caption}</figcaption>}</figure>}
          {text && <div className="mx-auto max-w-3xl px-5 pb-12 lg:px-14">{text}</div>}
          {!text && <div className="pb-10" />}
        </section>
      );
    }
    case "cta":
      return (
        <section className="border-t border-border/60 px-5 py-16 lg:px-14 lg:py-24">
          <div className="mx-auto max-w-4xl border border-gold/40 bg-card/50 px-6 py-12 text-center sm:px-12 lg:py-16">
            <Eyebrow t={s.eyebrow} /><H2 t={s.heading} />
            {s.body && <div className="mx-auto mt-6 max-w-2xl"><Paragraphs text={s.body} /></div>}
            <Buttons s={s} center />
          </div>
        </section>
      );
    default: // text, optionally with an image beside it
      return (
        <section className={`px-5 py-16 lg:px-14 lg:py-24 ${first ? "" : "border-t border-border/60"}`}>
          <div className={`mx-auto grid items-center gap-10 ${src ? "max-w-6xl lg:grid-cols-2 lg:gap-16" : "max-w-3xl"}`}>
            <div className={`min-w-0 ${src && imgLeft ? "lg:order-2" : ""}`}>
              <Eyebrow t={s.eyebrow} /><H2 t={s.heading} />
              {s.body && <div className="mt-7"><Paragraphs text={s.body} /></div>}
              <Buttons s={s} />
            </div>
            {src && <Img s={s} src={src} className="aspect-[4/5] max-h-[620px] border border-border/60 sm:aspect-[3/2] lg:aspect-[4/5]" />}
          </div>
        </section>
      );
  }
}

// One renderer for public pages and the admin preview, so both always look identical.
export function PageView({ eyebrow, title, intro, sections: raw, imageSrc, preview }: Props) {
  const sections = normalizeSections(raw);
  const hasHero = sections[0]?.kind === "hero";
  return (
    <PageShell>
      {preview && <div className="bg-gold px-5 py-2 text-center text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground">Podgląd — ta wersja nie jest jeszcze widoczna publicznie</div>}
      {!hasHero && <PageHeading eyebrow={eyebrow} title={title} intro={intro} />}
      <div className="overflow-x-hidden">
        {sections.map((s, i) => <Section key={s.id} s={s} first={i === 0 && !hasHero} src={s.image ? imageSrc(s.image) : undefined} />)}
      </div>
    </PageShell>
  );
}

// Sections only, without the page shell — used inside article pages.
export function PageSections({ sections: raw, imageSrc }: { sections: PageSection[]; imageSrc: (file: string) => string | undefined }) {
  const sections = normalizeSections(raw);
  return <>{sections.map((s, i) => <Section key={s.id} s={s} first={i === 0} src={s.image ? imageSrc(s.image) : undefined} />)}</>;
}
