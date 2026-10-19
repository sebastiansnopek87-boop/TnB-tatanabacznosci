import { Link } from "@tanstack/react-router";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { ArrowRight, ChevronRight } from "lucide-react";
import { HOME_ASSETS } from "@/lib/home-assets";
import { legacySection } from "@/lib/home-legacy";
import type { PageItem } from "@/lib/pages";
import { Txt, editAttrs, type BlockProps } from "./home-edit";

export function PillarCards({ s = legacySection("pillars"), sel, imageSrc }: BlockProps) {
  const { visiblePath } = useModuleVisibility();
  const a = editAttrs(sel);
  const edit = sel !== undefined;
  const all = s.items.map((it, i) => ({ it, i })).filter(({ it }) => edit || (!it.hidden && visiblePath(it.href ?? "/")));
  const img = (it: PageItem) => (it.image && imageSrc?.(it.image)) || (it.asset ? HOME_ASSETS[it.asset]?.src : undefined);
  const cards = all.filter(({ it }) => (it.variant ?? "card") === "card");
  const tiles = all.filter(({ it }) => it.variant === "tile");
  const pos = (it: PageItem) => it.focalX !== undefined || it.focalY !== undefined ? { objectPosition: `${it.focalX ?? 100}% ${it.focalY ?? 50}%` } : undefined;
  return (
    <section className="bg-background px-3 pt-10 pb-16 sm:px-5 lg:px-10 lg:pt-20 lg:pb-28"><div className="mx-auto max-w-[1440px] space-y-4 lg:space-y-6">
      {cards.length > 0 && <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {cards.map(({ it, i }, n) => (
          <article key={i} {...a(`item-${i}`)} className={`group relative isolate min-h-[280px] overflow-hidden border border-border/50 bg-surface lg:min-h-[340px] ${it.hidden ? "opacity-40" : ""}`}>
            {img(it) && <img src={img(it)} alt={it.imageAlt ?? ""} loading="lazy" decoding="async" style={pos(it)} className="absolute inset-0 -z-20 h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.04]" />}
            <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, oklch(0.132 0.01 58 / 0.97) 0%, oklch(0.132 0.01 58 / 0.9) 42%, oklch(0.132 0.01 58 / 0.3) 78%, transparent 100%)" }} />
            <div className="flex h-full min-h-[inherit] flex-col p-7 lg:p-9">
              <span className="text-[0.72rem] tracking-[0.2em] text-gold">{String(n + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-display text-[1.75rem] font-medium uppercase tracking-[0.04em] text-foreground"><Txt s={s} k={`item-${i}-title`} text={it.title} /></h3>
              <p className="mt-4 max-w-[19rem] text-[0.86rem] leading-[1.7] text-foreground/85"><Txt s={s} k={`item-${i}-body`} text={it.body} /></p>
              {it.cta && <Link to={(it.href || "/") as "/"} className="mt-auto inline-flex w-fit items-center gap-6 border border-gold/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-gold/10">
                {it.cta}<ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>}
            </div>
          </article>
        ))}
      </div>}
      {tiles.length > 0 && <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {tiles.map(({ it, i }) => (
          <Link key={i} {...a(`item-${i}`)} to={(it.href || "/") as "/"} className={`group flex items-stretch border border-border/50 bg-surface transition-colors hover:border-gold/50 ${it.hidden ? "opacity-40" : ""}`}>
            {img(it) && <img src={img(it)} alt={it.imageAlt ?? ""} loading="lazy" decoding="async" style={pos(it)} className="h-[120px] w-[38%] shrink-0 object-cover sm:w-[32%] lg:h-[136px]" />}
            <div className="flex flex-1 items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <h3 className="text-[0.82rem] uppercase tracking-[0.14em] text-foreground"><Txt s={s} k={`item-${i}-title`} text={it.title} /></h3>
                <p className="mt-2 whitespace-pre-line text-[0.78rem] leading-[1.55] text-muted-foreground"><Txt s={s} k={`item-${i}-body`} text={it.body} /></p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-foreground/70 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </div>
          </Link>
        ))}
      </div>}
    </div></section>
  );
}
