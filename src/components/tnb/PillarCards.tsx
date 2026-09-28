import { ArrowRight, ChevronRight } from "lucide-react";
import cardHistoria from "@/assets/card-historia.jpg.asset.json";
import cardBiblioteka from "@/assets/card-biblioteka.jpg.asset.json";
import cardPodcast from "@/assets/card-podcast.jpg.asset.json";
import tileSpolecznosc from "@/assets/tile-spolecznosc.jpg.asset.json";
import tileSpotkania from "@/assets/tile-spotkania.jpg.asset.json";
import tileTworczosc from "@/assets/tile-tworczosc.jpg.asset.json";

const CARDS = [
  {
    num: "01",
    id: "moja-historia",
    title: "Moja historia",
    desc: "Od trudnych początków, przez 18 lat służby, po rodzinę, życie po mundurze i wszystko to, co nauczyło mnie pokory, odpowiedzialności i wdzięczności.",
    cta: "Poznaj moją drogę",
    image: cardHistoria.url,
    alt: "Portret mężczyzny w ciepłym świetle",
  },
  {
    num: "02",
    id: "biblioteka",
    title: "Biblioteka TNB",
    desc: "Artykuły, e-booki, podcasty, muzyka, wiersze i rozmowy, które zostają na dłużej.",
    cta: "Przeglądaj materiały",
    image: cardBiblioteka.url,
    alt: "Książki i kubek kawy w ciepłym świetle",
  },
  {
    num: "03",
    id: "podcast",
    title: "Podcast TNB",
    desc: "Rozmowy o życiu, wartościach, relacjach, wyzwaniach i powrotach. Prawdziwe historie, bez udawania.",
    cta: "Słuchaj podcastu",
    image: cardPodcast.url,
    alt: "Mikrofon studyjny",
  },
];

const TILES = [
  {
    id: "spolecznosc",
    title: "Społeczność",
    desc: "Miejsce, w którym możesz czytać, komentować, dzielić się doświadczeniami i być częścią czegoś większego.",
    image: tileSpolecznosc.url,
    alt: "Ludzie przy ognisku",
  },
  {
    id: "spotkania",
    title: "Spotkania 1:1",
    desc: "Czas na rozmowę.\nCzas dla Ciebie.",
    image: tileSpotkania.url,
    alt: "Rozświetlona chata wieczorem",
  },
  {
    id: "tworczosc",
    title: "Moja twórczość",
    desc: "Muzyka, wiersze, teksty.\nInny wymiar tych samych doświadczeń.",
    image: tileTworczosc.url,
    alt: "Kompas i mapa",
  },
];

export function PillarCards() {
  return (
    <section className="space-y-3 bg-background px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {CARDS.map((card) => (
          <article
            key={card.num}
            id={card.id}
            className="group relative isolate min-h-[240px] overflow-hidden border border-border/50 bg-surface"
          >
            <img
              src={card.image}
              alt={card.alt}
              className="absolute inset-0 -z-20 h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(90deg, oklch(0.132 0.01 58 / 0.97) 0%, oklch(0.132 0.01 58 / 0.9) 42%, oklch(0.132 0.01 58 / 0.3) 78%, transparent 100%)",
              }}
            />
            <div className="flex h-full flex-col p-7">
              <span className="text-[0.72rem] tracking-[0.2em] text-gold">{card.num}</span>
              <h3 className="mt-3 font-display text-[1.75rem] font-medium uppercase tracking-[0.04em] text-foreground">
                {card.title}
              </h3>
              <p className="mt-4 max-w-[19rem] text-[0.86rem] leading-[1.7] text-foreground/85">
                {card.desc}
              </p>
              <a
                href={`#${card.id}`}
                className="mt-auto inline-flex w-fit items-center gap-6 border border-gold/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-gold/10"
              >
                {card.cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {TILES.map((tile) => (
          <a
            key={tile.id}
            id={tile.id}
            href={`#${tile.id}`}
            className="group flex items-stretch border border-border/50 bg-surface transition-colors hover:border-gold/50"
          >
            <img
              src={tile.image}
              alt={tile.alt}
              className="h-[104px] w-[38%] shrink-0 object-cover sm:w-[32%]"
            />
            <div className="flex flex-1 items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <h3 className="text-[0.82rem] uppercase tracking-[0.14em] text-foreground">
                  {tile.title}
                </h3>
                <p className="mt-2 whitespace-pre-line text-[0.78rem] leading-[1.55] text-muted-foreground">
                  {tile.desc}
                </p>
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-foreground/70 transition-transform group-hover:translate-x-1"
                strokeWidth={1.5}
              />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
