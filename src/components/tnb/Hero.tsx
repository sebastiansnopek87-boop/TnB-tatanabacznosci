import { ArrowRight } from "lucide-react";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { assetUrl, focusClass, HOME_ASSETS } from "@/lib/home-content";
import { Gold, SmartLink, noA, setting, type HomeBlockProps } from "./home/util";

export function Hero({ s, a = noA, imageSrc }: HomeBlockProps) {
  const { visible } = useModuleVisibility();
  const f = (k: string) => setting(s, k);
  const src = (s.image && (assetUrl(s.image) ?? imageSrc?.(s.image))) || HOME_ASSETS["hero"];
  const ctaHref = f("ctaHref") || "/o-tnb";
  const showCta = !!f("ctaLabel") && (ctaHref !== "/o-tnb" || visible("about"));
  const points = f("asidePoints").split("\n").filter((l) => l.trim());
  return (
    <section id="start" className="relative isolate overflow-hidden">
      <img {...a("image")} src={src} fetchPriority="high" decoding="async" alt={s.decorative ? "" : s.imageAlt}
        className={`absolute inset-0 -z-20 h-full w-full object-cover ${focusClass(f("focus"))}`} />
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, oklch(0.132 0.01 58) 0%, oklch(0.132 0.01 58 / 0.94) 26%, oklch(0.132 0.01 58 / 0.45) 46%, transparent 62%)" }} />
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(0deg, oklch(0.132 0.01 58 / 0.85) 0%, transparent 35%, transparent 70%, oklch(0.132 0.01 58 / 0.55) 100%)" }} />

      <div className="relative flex min-h-[480px] flex-col justify-center px-5 py-14 lg:min-h-[560px] lg:px-14 lg:py-20">
        <div className="max-w-[560px]">
          {f("eyebrow") && <p {...a("f:eyebrow")} className="eyebrow text-foreground/85">{f("eyebrow")}</p>}
          <h1 className="mt-4 font-display uppercase leading-[0.95]">
            <span {...a("f:line1")} className="block text-[3.6rem] font-semibold tracking-[0.02em] text-foreground sm:text-[4.6rem]">{f("line1")}</span>
            {f("line2") && <span {...a("f:line2")} className="mt-1 block text-[1.55rem] font-medium tracking-[0.01em] text-gold sm:text-[2.45rem]">{f("line2")}</span>}
            {f("line3") && <span {...a("f:line3")} className="block text-[1.55rem] font-medium tracking-[0.01em] text-gold sm:text-[2.45rem]">{f("line3")}</span>}
          </h1>
          {f("body") && <p {...a("f:body")} className="mt-6 max-w-[430px] whitespace-pre-line text-[0.95rem] leading-[1.75] text-foreground/85">{f("body")}</p>}
          {showCta && <div className="mt-8 flex flex-wrap items-center gap-4">
            <SmartLink {...a("f:ctaLabel")} href={ctaHref} className="inline-flex items-center gap-8 bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright">
              {f("ctaLabel")}<ArrowRight className="h-4 w-4" strokeWidth={2} />
            </SmartLink>
          </div>}
        </div>

        <div className="mt-14 min-w-0 max-w-[440px] xl:absolute xl:right-14 xl:top-1/2 xl:mt-0 xl:w-[calc(100%-720px)] xl:max-w-[480px] xl:-translate-y-1/2">
          <div className="border-l border-gold/40 pl-4 sm:pl-6 xl:pl-8">
            {f("asideTitle") && <p {...a("f:asideTitle")} className="break-words font-display text-[1.3rem] font-medium uppercase leading-[1.25] text-foreground sm:text-[1.85rem]"><Gold t={f("asideTitle")} /></p>}
            {f("asideSub") && <p {...a("f:asideSub")} className="mt-5 text-[0.95rem] leading-[1.8] text-foreground/85">{f("asideSub")}</p>}
            {points.length > 0 && <div {...a("f:asidePoints")} className="mt-6 space-y-3.5 text-[0.92rem] leading-[1.75] text-foreground/75">
              {points.map((p, i) => <p key={i}><Gold t={p} /></p>)}
            </div>}
            {f("quote") && <blockquote {...a("f:quote")} className="mt-9 border-l-2 border-gold pl-5">
              <p className="font-display text-[1.25rem] font-medium leading-[1.3] text-gold sm:text-[1.5rem]">{f("quote")}</p>
            </blockquote>}
            {f("asideNote") && <p {...a("f:asideNote")} className="mt-9 max-w-[380px] whitespace-pre-line text-[0.85rem] leading-[1.75] text-foreground/60">{f("asideNote")}</p>}
          </div>
          {visible("community") && f("communityLabel") && (
            <p {...a("f:communityLabel")} className="mt-10 text-[0.78rem] uppercase tracking-[0.12em] text-foreground/55">
              {f("communityLead")}{" "}
              <SmartLink href={f("communityHref") || "/spolecznosc"} className="text-gold/85 underline-offset-4 transition-colors hover:text-gold hover:underline">{f("communityLabel")}</SmartLink>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
