import { Link } from "@tanstack/react-router";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { BookOpen, Calendar, Compass, Crosshair, House, Mic, ShieldCheck, ShoppingBag, UserRound, Users, type LucideIcon } from "lucide-react";
import { legacySection } from "@/lib/home-legacy";
import type { ItemIcon } from "@/lib/pages";
import { Txt, editAttrs, type BlockProps } from "./home-edit";

export const ITEM_ICON_COMPONENTS: Record<ItemIcon, LucideIcon | null> = { book: BookOpen, mic: Mic, users: Users, calendar: Calendar, compass: Compass, bag: ShoppingBag, user: UserRound, shield: ShieldCheck, family: House, target: Crosshair, none: null };

export function QuickNav({ s = legacySection("quick-nav"), sel }: BlockProps) {
  const { visiblePath } = useModuleVisibility();
  const a = editAttrs(sel);
  const edit = sel !== undefined;
  const items = s.items.map((it, i) => ({ it, i })).filter(({ it }) => edit || (!it.hidden && visiblePath(it.href ?? "/")));
  return (
    <section className="bg-surface-deep" id="o-tnb">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {items.map(({ it, i }, n) => {
          const Icon = ITEM_ICON_COMPONENTS[it.icon ?? "none"];
          return (
            <Link key={i} {...a(`item-${i}`)} to={(it.href || "/") as "/"}
              className={`group flex flex-col items-center px-5 py-9 text-center transition-colors hover:bg-surface ${n === 0 ? "" : "border-l border-border/60"} ${it.hidden ? "opacity-40" : ""}`}>
              {Icon && <Icon className="h-7 w-7 text-gold" strokeWidth={1.25} />}
              <h3 className="mt-4 text-[0.8rem] uppercase tracking-[0.14em] text-foreground"><Txt s={s} k={`item-${i}-title`} text={it.title} /></h3>
              <p className="mt-3 max-w-[15rem] text-[0.78rem] leading-[1.6] text-muted-foreground"><Txt s={s} k={`item-${i}-body`} text={it.body} /></p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
