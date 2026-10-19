import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { ArrowRight, ChevronRight } from "lucide-react";
import { assetUrl } from "@/lib/home-content";
import { SmartLink, noA, type HomeBlockProps } from "./home/util";

const img = (v: string | undefined, imageSrc: HomeBlockProps["imageSrc"]) => (v ? assetUrl(v) ?? imageSrc?.(v) : undefined);

// Large numbered cards. Together with PillarTiles directly below they keep the original spacing.
export function PillarCards({ s, a = noA, imageSrc }: HomeBlockProps) {
  const { visiblePath } = useModuleVisibility();
  const cards = s.items.map((it, k) => ({ ...it, k })).filter((c) => !c.href || visiblePath(c.href));
  return (
    <section className="bg-background px-3 pt-10 pb-2 sm:px-5 lg:px-10 lg:pt-20 lg:pb-3"><div className="mx-auto max-w-[1440px]">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {cards.map((card, i) => {
          const src = img(card.image, imageSrc);
          return (
            <article key={card.k} {...a(`item-${card.k}`)} className="group relative isolate min-h-[280px] lg:min-h-[340px] overflow-hidden border border-border/50 bg-surface">
              {src && <img src={src} alt={card.alt ?? ""} loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.04]" />}
              <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, oklch(0.132 0.01 58 / 0.97) 0%, oklch(0.132 0.01 58 / 0.9) 42%, oklch(0.132 0.01 58 / 0.3) 78%, transparent 100%)" }} />
              <div className="flex h-full min-h-[inherit] flex-col p-7 lg:p-9">
                <span className="text-[0.72rem] tracking-[0.2em] text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-display text-[1.75rem] font-medium uppercase tracking-[0.04em] text-foreground">{card.title}</h3>
                <p className="mt-4 max-w-[19rem] whitespace-pre-line text-[0.86rem] leading-[1.7] text-foreground/85">{card.body}</p>
                {card.cta && card.href && (
                  <SmartLink href={card.href} className="mt-auto inline-flex w-fit items-center gap-6 border border-gold/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-gold/10">
                    {card.cta}<ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  </SmartLink>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div></section>
  );
}

export function PillarTiles({ s, a = noA, imageSrc }: HomeBlockProps) {
  const { visiblePath } = useModuleVisibility();
  const tiles = s.items.map((it, k) => ({ ...it, k })).filter((t) => !t.href || visiblePath(t.href));
  return (
    <section className="bg-background px-3 pt-2 pb-16 sm:px-5 lg:px-10 lg:pt-3 lg:pb-28"><div className="mx-auto max-w-[1440px]">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {tiles.map((tile) => {
          const src = img(tile.image, imageSrc);
          return (
            <SmartLink key={tile.k} {...a(`item-${tile.k}`)} href={tile.href || "/"} className="group flex items-stretch border border-border/50 bg-surface transition-colors hover:border-gold/50">
              {src && <img src={src} alt={tile.alt ?? ""} loading="lazy" decoding="async" className="h-[120px] lg:h-[136px] w-[38%] shrink-0 object-cover sm:w-[32%]" />}
              <div className="flex flex-1 items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <h3 className="text-[0.82rem] uppercase tracking-[0.14em] text-foreground">{tile.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-[0.78rem] leading-[1.55] text-muted-foreground">{tile.body}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-foreground/70 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </div>
            </SmartLink>
          );
        })}
      </div>
    </div></section>
  );
}
