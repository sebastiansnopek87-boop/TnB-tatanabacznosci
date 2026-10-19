import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { SmartLink, noA, type HomeBlockProps } from "./home/util";
import {
  BookOpen,
  Calendar,
  Compass,
  Mic,
  ShoppingBag,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

// Icon per destination; new shortcuts fall back to the compass.
const ICONS: Record<string, LucideIcon> = { "/biblioteka": BookOpen, "/podcast": Mic, "/spolecznosc": Users, "/spotkania/rozmowa-1-1": Calendar, "/artykuly": Compass, "/materialy-premium": ShoppingBag, "/moje-tnb": UserRound };

export function QuickNav({ s, a = noA }: HomeBlockProps) {
  const { visiblePath } = useModuleVisibility();
  return (
    <section className="bg-surface-deep" id="o-tnb">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {s.items.map((it, k) => ({ ...it, k })).filter((it) => it.href && visiblePath(it.href)).map(({ title, body: desc, href = "/", k }, i) => { const Icon = ICONS[href] ?? Compass; return (
          <SmartLink
            key={k}
            {...a(`item-${k}`)}
            href={href}
            className={`group flex flex-col items-center px-5 py-9 text-center transition-colors hover:bg-surface ${
              i === 0 ? "" : "border-l border-border/60"
            }`}
          >
            <Icon className="h-7 w-7 text-gold" strokeWidth={1.25} />
            <h3 className="mt-4 text-[0.8rem] uppercase tracking-[0.14em] text-foreground">
              {title}
            </h3>
            <p className="mt-3 max-w-[15rem] text-[0.78rem] leading-[1.6] text-muted-foreground">
              {desc}
            </p>
          </SmartLink>
        ); })}
      </div>
    </section>
  );
}
