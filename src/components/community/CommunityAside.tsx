import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import spotkaniaImg from "@/assets/tile-spotkania.jpg.asset.json";
import { Button } from "@/components/ui/button";

/** Planned target modules. Flip `active` to true once the route exists. */
export const MEETING_CARDS = [
  {
    id: "spotkania",
    href: "/spotkania",
    active: false,
    image: spotkaniaImg.url,
    title: "Spotkajmy się naprawdę",
    body: "Rozmowy, które zaczynają się tutaj, mogą przenieść się poza ekran. Organizuję spotkania online, spotkania na żywo i wspólne wyjścia w teren. Bez scenariuszy, bez udawania — po prostu ludzie i prawdziwe rozmowy.",
    cta: "Zobacz spotkania",
  },
  {
    id: "spotkania-1-na-1",
    href: "/spotkania/rozmowa-1-1",
    active: true,
    image: null,
    title: "Porozmawiajmy indywidualnie",
    body: "Czasem łatwiej powiedzieć coś w cztery oczy. Jeśli potrzebujesz rozmowy, chcesz podzielić się swoją historią albo spojrzeć na coś z innej perspektywy — możemy porozmawiać indywidualnie.",
    cta: "Umów rozmowę",
  },
] as const;

export function CommunityAside() {
  return (
    <aside aria-label="Spotkania TNB" className="space-y-6">
      {MEETING_CARDS.map((c) => (
        <section key={c.id} aria-labelledby={`${c.id}-h`} data-planned-href={c.href}
          className="relative overflow-hidden rounded-sm border border-gold/40 bg-gradient-to-b from-card to-background shadow-lg">
          <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
          {c.image && <img src={c.image} alt="" loading="lazy" className="h-32 w-full object-cover opacity-80" />}
          <div className="p-5">
            <h2 id={`${c.id}-h`} className="font-display text-xl font-semibold uppercase leading-tight tracking-[0.04em] text-gold">{c.title}</h2>
            <p className="mt-3 text-[0.85rem] leading-[1.7] text-foreground/80">{c.body}</p>
            {c.active ? (
              <Button asChild className="mt-5 w-full uppercase tracking-[0.15em]">
                <Link to={c.href as "/"}>{c.cta} <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (<>
              <Button type="button" disabled aria-disabled className="mt-5 w-full uppercase tracking-[0.15em]">{c.cta}</Button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Clock aria-hidden className="h-3.5 w-3.5" /> W przygotowaniu
              </p>
            </>)}
          </div>
        </section>
      ))}
    </aside>
  );
}
