import { ArrowRight, BookOpen, CirclePlay, Crosshair, ShieldCheck, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { assetUrl, focusClass } from "@/lib/home-content";
import { useAuth } from "@/hooks/use-auth";
import { resolveHomeCta } from "@/lib/home-cta";
import { SmartLink, noA, setting, type HomeBlockProps } from "./util";

const icons = [Users, BookOpen, ShieldCheck, UsersRound, Crosshair];

export function CinematicHero({ s, a = noA, imageSrc }: HomeBlockProps) {
  const f = (key: string) => setting(s, key);
  const { visible } = useModuleVisibility();
  const { status } = useAuth();
  const cta = resolveHomeCta(s.settings, status);
  const allowed = (href: string) => (href !== "/spolecznosc" || visible("community")) && (href !== "/o-tnb" || visible("about"));
  return (
    <section data-cinematic-hero data-height={f("sceneHeight")} data-contrast={f("contrast")} className="cinematic-hero bg-cinematic-background text-cinematic-foreground">
      <div className="cinematic-scenes grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {s.items.slice(0, 5).map((scene, i) => (
          <article key={i} {...a(`item-${i}`)} className="cinematic-scene relative isolate flex min-w-0 items-end justify-center overflow-hidden">
            <img src={assetUrl(scene.image) ?? (scene.image ? imageSrc?.(scene.image) : undefined)} alt={scene.alt ?? ""} width={768} height={1024} fetchPriority={i === 0 ? "high" : "auto"} decoding="async" className={`absolute inset-0 -z-20 h-full w-full object-cover ${focusClass(f(`scene${i + 1}Focus`))}`} />
            <div className="cinematic-scene-shade absolute inset-0 -z-10" />
            <div className="w-full px-5 pb-7 text-center">
              <h3 className="mx-auto max-w-60 whitespace-pre-line break-words font-display text-xl font-semibold uppercase leading-tight text-cinematic-copper">{scene.title}</h3>
              <p className="mx-auto mt-3 max-w-64 whitespace-pre-line break-words font-display text-base leading-snug text-cinematic-foreground/85">{scene.body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-center lg:pb-9">
        <h2 className="font-display text-4xl font-medium uppercase leading-[1.05] sm:text-5xl lg:text-6xl">
          <span {...a("f:line1")}>{f("line1")}</span>{" "}<span {...a("f:line2")} className="text-cinematic-copper">{f("line2")}</span>
        </h2>
        <p {...a("f:body")} className="mx-auto mt-4 max-w-4xl whitespace-pre-line font-display text-lg leading-relaxed text-cinematic-foreground/85">{f("body")}</p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {cta.visible && allowed(cta.href) && <Button asChild variant="cinematic" size="lg" className="h-auto min-h-12 whitespace-normal rounded-sm py-3 text-xs uppercase">
            <SmartLink {...a("f:ctaLabel")} href={cta.href}><span>{f("ctaLabel")}</span><ArrowRight aria-hidden /></SmartLink>
          </Button>}
          {f("secondaryLabel") && allowed(f("secondaryHref")) && <Button asChild variant="cinematicOutline" size="lg" className="h-auto min-h-12 whitespace-normal rounded-sm py-3 text-xs uppercase">
            <SmartLink {...a("f:secondaryLabel")} href={f("secondaryHref")}><CirclePlay aria-hidden /><span>{f("secondaryLabel")}</span></SmartLink>
          </Button>}
        </div>
      </div>
      {f("valuesVisible") !== "off" && <div className="border-y border-cinematic-copper/20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
          {icons.map((Icon, i) => (
            <div key={i} className="flex min-w-0 gap-4 lg:border-l lg:border-cinematic-copper/30 lg:px-5 lg:first:border-l-0">
              <Icon aria-hidden className="mt-1 size-8 shrink-0 text-cinematic-copper" strokeWidth={1.5} />
              <div className="min-w-0">
                <h3 {...a(`f:value${i + 1}Title`)} className="break-words font-display text-base font-semibold uppercase leading-tight text-cinematic-copper">{f(`value${i + 1}Title`)}</h3>
                <p {...a(`f:value${i + 1}Body`)} className="mt-2 whitespace-pre-line break-words font-display text-sm leading-relaxed text-cinematic-foreground/65">{f(`value${i + 1}Body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>}
    </section>
  );
}