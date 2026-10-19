import { ArrowRight } from "lucide-react";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { HOME_ASSETS } from "@/lib/home-assets";
import { legacySection } from "@/lib/home-legacy";
import { Txt, editAttrs, paras, type BlockProps } from "./home-edit";

export function Hero({ s = legacySection("home-hero"), sel, imageSrc }: BlockProps) {
  const { visiblePath } = useModuleVisibility();
  const a = editAttrs(sel);
  const edit = sel !== undefined;
  const src = (s.image && imageSrc?.(s.image)) || HOME_ASSETS["hero"]!.src;
  const [lead, lines, quote] = [s.items[0], s.items[1], s.items[2]];
  const [main, link] = [s.buttons[0], s.buttons[1]];
  const show = (b?: { href: string; hidden?: boolean }) => !!b && (edit || (!b.hidden && visiblePath(b.href)));
  return (
    <section id="start" className="relative isolate overflow-hidden">
      <img {...a("image")} src={src} fetchPriority="high" decoding="async" alt={s.decorative ? "" : s.imageAlt}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, oklch(0.132 0.01 58) 0%, oklch(0.132 0.01 58 / 0.94) 26%, oklch(0.132 0.01 58 / 0.45) 46%, transparent 62%)" }} />
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(0deg, oklch(0.132 0.01 58 / 0.85) 0%, transparent 35%, transparent 70%, oklch(0.132 0.01 58 / 0.55) 100%)" }} />

      <div className="relative flex min-h-[480px] flex-col justify-center px-5 py-14 lg:min-h-[560px] lg:px-14 lg:py-20">
        <div className="max-w-[560px]">
          {s.eyebrow && <p {...a("eyebrow")} className="eyebrow text-foreground/85"><Txt s={s} k="eyebrow" text={s.eyebrow} /></p>}
          <h1 className="mt-4 font-display uppercase leading-[0.95]">
            <span {...a("heading")} className="block text-[3.6rem] font-semibold tracking-[0.02em] text-foreground sm:text-[4.6rem]"><Txt s={s} k="heading" text={s.heading} /></span>
            <span {...a("caption")} className="mt-1 block whitespace-pre-line text-[1.55rem] font-medium tracking-[0.01em] text-gold sm:text-[2.45rem]"><Txt s={s} k="caption" text={s.caption} /></span>
          </h1>
          {s.body && <p {...a("body")} className="mt-6 max-w-[430px] text-[0.95rem] leading-[1.75] text-foreground/85"><Txt s={s} k="body" text={s.body} /></p>}
          {show(main) && <div className="mt-8 flex flex-wrap items-center gap-4">
            <a {...a("button-0")} href={main!.href} className={`inline-flex items-center gap-8 bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright ${main!.hidden ? "opacity-40" : ""}`}>
              <Txt s={s} k="button-0" text={main!.label} />
              {main!.icon !== "none" && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
            </a>
          </div>}
        </div>

        <div className="mt-14 min-w-0 max-w-[440px] xl:absolute xl:right-14 xl:top-1/2 xl:mt-0 xl:w-[calc(100%-720px)] xl:max-w-[480px] xl:-translate-y-1/2">
          <div className="border-l border-gold/40 pl-4 sm:pl-6 xl:pl-8">
            {lead && (edit || !lead.hidden) && <div {...a("item-0")} className={lead.hidden ? "opacity-40" : ""}>
              <p className="break-words font-display text-[1.3rem] font-medium uppercase leading-[1.25] text-foreground sm:text-[1.85rem]"><Txt s={s} k="item-0-title" text={lead.title} /></p>
              {lead.body && <p className="mt-5 text-[0.95rem] leading-[1.8] text-foreground/85"><Txt s={s} k="item-0-body" text={lead.body} /></p>}
            </div>}
            {lines && (edit || !lines.hidden) && <div {...a("item-1")} className={`mt-6 space-y-3.5 text-[0.92rem] leading-[1.75] text-foreground/75 ${lines.hidden ? "opacity-40" : ""}`}>
              {s.textFormats?.["item-1-body"] ? <Txt s={s} k="item-1-body" text={lines.body} inline={false} /> : paras(lines.body).map((p, i) => <p key={i}><Txt s={s} k="-" text={p} /></p>)}
            </div>}
            {quote && (edit || !quote.hidden) && <div {...a("item-2")} className={quote.hidden ? "opacity-40" : ""}>
              {quote.title && <blockquote className="mt-9 border-l-2 border-gold pl-5"><p className="font-display text-[1.25rem] font-medium leading-[1.3] text-gold sm:text-[1.5rem]"><Txt s={s} k="item-2-title" text={quote.title} /></p></blockquote>}
              {quote.body && <p className="mt-9 max-w-[380px] text-[0.85rem] leading-[1.75] text-foreground/60"><Txt s={s} k="item-2-body" text={quote.body} /></p>}
            </div>}
          </div>
          {show(link) && (
            <p className={`mt-10 text-[0.78rem] uppercase tracking-[0.12em] text-foreground/55 ${link!.hidden ? "opacity-40" : ""}`}>
              {s.quoteAuthor && <span {...a("quoteAuthor")}><Txt s={s} k="quoteAuthor" text={s.quoteAuthor} />{" "}</span>}
              <a {...a("button-1")} href={link!.href} className="text-gold/85 underline-offset-4 transition-colors hover:text-gold hover:underline"><Txt s={s} k="button-1" text={link!.label} /></a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
