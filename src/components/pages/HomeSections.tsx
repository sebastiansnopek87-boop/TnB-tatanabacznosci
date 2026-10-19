import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, CirclePlay, Crosshair, ShieldCheck, UsersRound, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/tnb/SiteHeader";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { HOME_ASSETS } from "@/lib/home-assets";
import { isSafeHref, type PageSection } from "@/lib/pages";
import { RichText } from "./RichText";

export function homeAppearance(s: PageSection): CSSProperties {
  return { "--home-height": `${s.appearance?.height ?? 410}px`, "--home-padding": `${s.appearance?.padding ?? 32}px`, "--home-gap": `${s.appearance?.gap ?? 0}px`, "--home-width": `${s.appearance?.width ?? 820}px`, "--home-overlay": (s.appearance?.overlay ?? 65) / 100, textAlign: s.appearance?.align ?? "center" } as CSSProperties;
}
export function HomeSection({ s, imageSrc, sel }: { s: PageSection; imageSrc: (n: string) => string | undefined; sel?: string | null | undefined }) {
  const { visiblePath } = useModuleVisibility();
  const edit = sel !== undefined;
  const a = (el: string) => edit ? { "data-el": el, ...(sel === el ? { "data-on": "" } : {}) } : {};
  const tone = s.appearance?.tone ?? "copper";
  if (s.kind === "home-nav") return <div style={homeAppearance(s)}><SiteHeader homeSection={s} editing={edit} /></div>;
  const icons = { users: UsersRound, book: BookOpen, shield: ShieldCheck, family: House, target: Crosshair, none: null };
  const items = s.items.map((it, i) => ({ it, i })).filter(({ it }) => edit || !it.hidden);
  return <section className={`home-section home-tone-${tone} ${s.kind === "cinematic" ? "home-cinematic" : "home-values"}`} style={homeAppearance(s)}>
    {s.kind === "cinematic" ? <>
      <div className="home-scenes" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map(({ it, i }) => {
          const src = it.image ? imageSrc(it.image) : it.asset ? HOME_ASSETS[it.asset]?.src : undefined;
          return <article key={i} {...a(`item-${i}`)} className={`home-scene ${it.hidden ? "opacity-40" : ""}`}>
            {src && <img {...a(`item-${i}-image`)} src={src} width={768} height={1152} fetchPriority={i === 0 ? "high" : "auto"} alt={it.imageAlt ?? ""} className="home-scene-image" style={{ objectPosition: `${it.focalX ?? 50}% ${it.focalY ?? 35}%` }} />}
            <div aria-hidden className="home-scene-shade" />
            <div className="home-scene-caption" style={{ textAlign: it.align ?? "center" }}>
              <h2 {...a(`item-${i}-title`)} className="home-scene-title"><RichText format={s.textFormats?.[`item-${i}-title`]} fallback={it.title} inline /></h2>
              <div {...a(`item-${i}-body`)} className="home-scene-body"><RichText format={s.textFormats?.[`item-${i}-body`]} fallback={it.body} /></div>
              {!edit && it.href && isSafeHref(it.href) && visiblePath(it.href, "page") && <a className="home-scene-link" href={it.href} aria-label={it.title.replace(/\n/g, " ")} />}
            </div>
          </article>;
        })}
      </div>
      <div className="home-intro">
        <h1 className="home-headline"><span {...a("heading")}><RichText format={s.textFormats?.["heading"]} fallback={s.heading} inline /></span>{" "}<span {...a("caption")} className="home-highlight"><RichText format={s.textFormats?.["caption"]} fallback={s.caption} inline /></span></h1>
        <div {...a("body")} className="home-intro-body"><RichText format={s.textFormats?.["body"]} fallback={s.body} /></div>
        <div className="home-ctas">
          {s.buttons.map((b, i) => (edit || !b.hidden) && (edit || visiblePath(b.href, "page")) ? <Button key={i} asChild variant="ghost" className={`home-cta home-cta-${b.variant ?? (i === 0 ? "solid" : "outline")} ${b.hidden ? "opacity-40" : ""}`}><a {...a(`button-${i}`)} href={isSafeHref(b.href) ? b.href : undefined}>{b.icon === "play" && <CirclePlay className="size-5" strokeWidth={1.4} />}<RichText format={s.textFormats?.[`button-${i}`]} fallback={b.label} inline />{b.icon === "arrow" && <ArrowRight className="size-4" />}</a></Button> : null)}
        </div>
      </div>
    </> : <div className="home-value-grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
      {items.map(({ it, i }) => { const Icon = icons[it.icon ?? "users"]; return <article {...a(`item-${i}`)} key={i} className={`home-value ${it.hidden ? "opacity-40" : ""}`} style={{ textAlign: it.align ?? "left" }}>
        {Icon && <Icon className="home-value-icon" strokeWidth={1.4} />}
        <div className="min-w-0"><h2 {...a(`item-${i}-title`)}><RichText format={s.textFormats?.[`item-${i}-title`]} fallback={it.title} inline /></h2><div {...a(`item-${i}-body`)} className="home-value-body"><RichText format={s.textFormats?.[`item-${i}-body`]} fallback={it.body} /></div></div>
        {!edit && it.href && isSafeHref(it.href) && visiblePath(it.href, "page") && <a className="home-scene-link" href={it.href} aria-label={it.title.replace(/\n/g, " ")} />}
      </article>; })}
    </div>}
  </section>;
}