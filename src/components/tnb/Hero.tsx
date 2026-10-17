import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero-opt.jpg.asset.json";
import { useModuleVisibility } from "@/hooks/use-module-visibility";


export function Hero() {
  const { visible } = useModuleVisibility();
  return (
    <section id="start" className="relative isolate overflow-hidden">
      <img
        src={hero.url}
        fetchPriority="high"
        decoding="async"
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

          {visible("about") && <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/o-tnb"
              className="inline-flex items-center gap-8 bg-gold px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-bright"
            >
              Poznaj TNB
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>}
        </div>

        <div className="mt-14 min-w-0 max-w-[440px] xl:absolute xl:right-14 xl:top-1/2 xl:mt-0 xl:w-[calc(100%-720px)] xl:max-w-[480px] xl:-translate-y-1/2">
          <div className="border-l border-gold/40 pl-4 sm:pl-6 xl:pl-8">
            <p className="break-words font-display text-[1.3rem] font-medium uppercase leading-[1.25] text-foreground sm:text-[1.85rem]">
              Nie musisz mieć{" "}
              <span className="text-gold">wszystkiego poukładanego</span>.
            </p>
            <p className="mt-5 text-[0.95rem] leading-[1.8] text-foreground/85">
              Wystarczy, że nie przestajesz szukać.
            </p>
            <div className="mt-6 space-y-3.5 text-[0.92rem] leading-[1.75] text-foreground/75">
              <p>
                Możesz być <span className="text-gold">silny</span> i mieć gorszy
                dzień.
              </p>
              <p>
                Możesz <span className="text-gold">kochać swoją rodzinę</span> i
                czasem nie wiedzieć, co zrobić.
              </p>
              <p>
                Możesz mieć za sobą wiele i wciąż{" "}
                <span className="text-gold">próbować zrozumieć siebie</span>.
              </p>
            </div>
            <blockquote className="mt-9 border-l-2 border-gold pl-5">
              <p className="font-display text-[1.25rem] font-medium leading-[1.3] text-gold sm:text-[1.5rem]">
                „Nie musisz tu nikomu niczego udowadniać.”
              </p>
            </blockquote>
            <p className="mt-9 max-w-[380px] text-[0.85rem] leading-[1.75] text-foreground/60">
              To miejsce dla ludzi, którzy chcą żyć bardziej świadomie, być
              bliżej swoich bliskich i nie zgubić po drodze samych siebie.
            </p>
          </div>
          {visible("community") && (
            <p className="mt-10 text-[0.78rem] uppercase tracking-[0.12em] text-foreground/55">
              Nie musisz być sam —{" "}
              <a
                href="/spolecznosc"
                className="text-gold/85 underline-offset-4 transition-colors hover:text-gold hover:underline"
              >
                dołącz do społeczności
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
