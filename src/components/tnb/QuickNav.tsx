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

const ITEMS: { icon: LucideIcon; title: string; desc: string; href: string }[] = [
  { icon: BookOpen, title: "Biblioteka", desc: "Artykuły, e-booki, wideo, muzyka, polecajki", href: "#biblioteka" },
  { icon: Mic, title: "Podcast", desc: "Rozmowy, historie, wyjątkowi goście", href: "#podcast" },
  { icon: Users, title: "Społeczność", desc: "Ludzie, doświadczenia, wsparcie", href: "#spolecznosc" },
  { icon: Calendar, title: "Spotkania 1:1", desc: "Rozmowa, mentoring, czas dla Ciebie", href: "#spotkania" },
  { icon: Compass, title: "Rozwój", desc: "Praktyczne materiały, narzędzia, wyzwania", href: "#rozwoj" },
  { icon: ShoppingBag, title: "Materiały premium", desc: "Wybrane treści, które zostaną z Tobą na dłużej", href: "/materialy-premium" },
  { icon: UserRound, title: "Moje TNB", desc: "Twój profil, postępy, zapisane treści", href: "#moje-tnb" },
];

export function QuickNav() {
  return (
    <section className="bg-surface-deep" id="o-tnb">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {ITEMS.map(({ icon: Icon, title, desc, href }, i) => (
          <a
            key={title}
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
          </a>
        ))}
      </div>
    </section>
  );
}
