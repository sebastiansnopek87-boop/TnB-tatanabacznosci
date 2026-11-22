import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/logo-384.webp.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tata Na Baczności — Niebawem otwarcie" },
      {
        name: "description",
        content:
          "Tu powstaje przestrzeń społeczności Tata Na Baczności. Miejsce prawdziwych historii, rozmów i wsparcia. Niebawem otwarcie.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Tata Na Baczności — Niebawem otwarcie" },
      {
        property: "og:description",
        content: "Tu powstaje przestrzeń społeczności Tata Na Baczności.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#101316] px-6 py-16 text-center text-[#f4f0e8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(151, 105, 57, 0.20) 0%, rgba(151, 105, 57, 0.07) 34%, transparent 68%), linear-gradient(145deg, #171b1e 0%, #0d1012 58%, #171513 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#a77b4c]/70 to-transparent"
      />
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute h-64 w-64 rounded-full bg-[#a77b4c]/10 blur-3xl sm:h-80 sm:w-80"
          />
          <img
            src={logo.url}
            alt="Logo Tata Na Baczności"
            className="relative h-auto w-56 max-w-[70vw] object-contain drop-shadow-[0_12px_35px_rgba(0,0,0,0.45)] sm:w-72"
          />
        </div>

        <div className="mt-10 flex items-center gap-3" aria-label="Strona w przygotowaniu">
          <span className="h-px w-8 bg-[#a77b4c]/70 sm:w-14" />
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#c6a47d] sm:text-xs">
            Tata Na Baczności
          </p>
          <span className="h-px w-8 bg-[#a77b4c]/70 sm:w-14" />
        </div>

        <h1 className="mt-7 max-w-2xl font-serif text-3xl font-medium leading-tight tracking-wide text-[#f4f0e8] sm:text-5xl">
          Tu powstaje przestrzeń społeczności
          <span className="mt-2 block text-[#c6a47d]">Tata Na Baczności</span>
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-7 text-[#b9b6b0] sm:text-base">
          Miejsce prawdziwych historii, rozmów i ludzi, dla których rodzina,
          odpowiedzialność i wartości mają znaczenie.
        </p>

        <div className="mt-12 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-[#c6a47d] shadow-[0_0_14px_rgba(198,164,125,0.8)] motion-safe:animate-pulse"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4b58f] motion-safe:animate-pulse sm:text-sm">
            Niebawem otwarcie
          </p>
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-[#c6a47d] shadow-[0_0_14px_rgba(198,164,125,0.8)] motion-safe:animate-pulse"
          />
        </div>

        <div className="mt-16 h-px w-24 bg-gradient-to-r from-transparent via-[#a77b4c]/60 to-transparent" />
        <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-[#77736d]">
          Czuwaj nad tym, co naprawdę ważne
        </p>
      </section>
    </main>
  );
}
