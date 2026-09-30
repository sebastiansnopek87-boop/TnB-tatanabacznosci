import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero.jpg.asset.json";

const PILLARS = [
  "Sobą",
  "Rodziną",
  "Relacjami",
  "Wiarą",
  "Bezpieczeństwem",
  "Emocjami",
  "Przyszłością",
];

export function Hero() {
  return (
    <section id="start" className="relative isolate overflow-hidden">
      <img
        src={hero.url}
        alt="Ojciec z synem patrzący na zachód słońca w górach"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.132 0.01 58) 0%, oklch(0.132 0.01 58 / 0.94) 26%, oklch(0.132 0.01 58 / 0.45) 46%, transparent 62%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(0deg, oklch(0.132 0.01 58 / 0.85) 0%, transparent 35%, transparent 70%, oklch(0.132 0.01 58 / 0.55) 100%)",
        }}
      />

      <div className="relative flex min-h-[480px] flex-col justify-center px-5 py-14 lg:min-h-[560px] lg:px-14 lg:py-20">
        <div className="max-w-[560px]">
          <p className="eyebrow text-foreground/85">
            Doświadczenia · Ludzie · Rozmowy · Rozwój
          </p>
          <h1 className="mt-4 font-display uppercase leading-[0.95]">
            <span className="block text-[3.6rem] font-semibold tracking-[0.02em] text-foreground sm:text-[4.6rem]">
              Czuwaj
            </span>
            <span className="mt-1 block text-[1.55rem] font-medium tracking-[0.01em] text-gold sm:text-[2.45rem]">
              nad tym,
            </span>
            <span className="block text-[1.55rem] font-medium tracking-[0.01em] text-gold sm:text-[2.45rem]">
              co naprawdę ważne.
            </span>
          </h1>
          <p className="mt-6 max-w-[430px] text-[0.95rem] leading-[1.75] text-foreground/85">
            Tata Na Baczności to przestrzeń prawdziwych historii, rozmów, doświadczeń i
            wartości. Miejsce, w którym możesz coś zabrać dla siebie i zostawić coś od
            siebie.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/o-tnb"
              className="inline-flex items-center gap-8 bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright"
            >
              Poznaj TNB
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>
        </div>

        <div className="mt-12 lg:absolute lg:right-14 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">
          <ul className="relative flex flex-col gap-4 border-l border-dotted border-gold/50 pl-6">
            {PILLARS.map((p) => (
              <li key={p} className="relative flex items-center">
                <span className="absolute -left-[1.6rem] h-1.5 w-1.5 rounded-full bg-gold" />
                <span className="text-[0.82rem] uppercase tracking-[0.14em] text-foreground">
                  {p}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 border-l-2 border-gold pl-5">
            <p className="text-[0.8rem] uppercase tracking-[0.14em] text-gold">
              Nie musisz być sam
            </p>
            <a
              href="/spolecznosc"
              className="mt-2 flex items-center gap-10 text-[0.85rem] text-foreground/85 transition-colors hover:text-gold"
            >
              Dołącz do społeczności
              <ArrowRight className="h-4 w-4 text-gold" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
