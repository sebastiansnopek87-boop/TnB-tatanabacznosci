import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import logo from "@/assets/logo-384.webp.asset.json";
import { supabase } from "@/integrations/supabase/client";

type SubmitState =
  | { kind: "idle"; message: "" }
  | { kind: "success"; message: string }
  | { kind: "already"; message: string }
  | { kind: "error"; message: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tata Na Baczności — Zanim otworzymy drzwi" },
      {
        name: "description",
        content:
          "Powstaje przestrzeń społeczności Tata Na Baczności. Zostaw kontakt, a damy Ci znać, kiedy otworzymy drzwi.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Tata Na Baczności — Zanim otworzymy drzwi" },
      {
        property: "og:description",
        content: "Powstaje miejsce dla ojców i ludzi, dla których ważne są rodzina, odpowiedzialność i wartości.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  const startedAt = useRef(Date.now());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle", message: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setState({ kind: "idle", message: "" });
    const { data, error } = await supabase.functions.invoke<{ status: "saved" | "already" }>(
      "tnb-launch-waitlist",
      {
        body: {
          name: name.trim(),
          email: email.trim(),
          consent,
          website,
          elapsedMs: Date.now() - startedAt.current,
        },
      },
    );
    setBusy(false);
    if (error) {
      const context = (error as { context?: unknown }).context;
      let message = "Nie udało się zapisać. Spróbuj ponownie za chwilę.";
      if (context instanceof Response) {
        const payload = await context.clone().json().catch(() => null) as { message?: unknown } | null;
        if (typeof payload?.message === "string") message = payload.message;
      }
      setState({ kind: "error", message });
      return;
    }
    if (data?.status === "already") {
      setState({ kind: "already", message: "Ten adres jest już na liście. Damy Ci znać, gdy wystartujemy." });
      return;
    }
    setState({ kind: "success", message: "Jesteś na liście. Gdy otworzymy TNB, wyślemy Ci wiadomość." });
    setName("");
    setEmail("");
    setConsent(false);
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#101316] px-5 py-14 text-center text-[#f4f0e8] sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 34%, rgba(151, 105, 57, 0.22) 0%, rgba(151, 105, 57, 0.07) 35%, transparent 68%), linear-gradient(145deg, #171b1e 0%, #0d1012 58%, #171513 100%)",
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#a77b4c]/70 to-transparent" />

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div aria-hidden="true" className="absolute h-64 w-64 rounded-full bg-[#a77b4c]/10 blur-3xl sm:h-80 sm:w-80" />
          <img
            src={logo.url}
            alt="Logo Tata Na Baczności"
            className="relative h-auto w-48 max-w-[68vw] object-contain drop-shadow-[0_12px_35px_rgba(0,0,0,0.45)] sm:w-60"
          />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px w-8 bg-[#a77b4c]/70 sm:w-14" />
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#c6a47d] sm:text-xs">
            Coś ważnego jest w drodze
          </p>
          <span className="h-px w-8 bg-[#a77b4c]/70 sm:w-14" />
        </div>

        <h1 className="mt-7 max-w-2xl font-serif text-3xl font-medium leading-tight tracking-wide text-[#f4f0e8] sm:text-5xl">
          Nie każdy musi iść przez życie
          <span className="mt-2 block text-[#c6a47d]">na własną rękę.</span>
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-7 text-[#c4c0b8] sm:text-base">
          Tworzymy przestrzeń dla ojców i ludzi, którzy wiedzą, że rodzina,
          odpowiedzialność i wartości wymagają obecności. Będzie tu miejsce na
          prawdziwe historie, rozmowy bez udawania, wzajemne wsparcie i doświadczenia,
          którymi warto się dzielić.
        </p>
        <p className="mt-3 text-sm font-medium text-[#d4b58f] sm:text-base">
          Tata Na Baczności. Zostań blisko — dopiero otwieramy drzwi.
        </p>

        <div className="mt-9 flex items-center gap-3" aria-label="Trwają przygotowania do otwarcia">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#c6a47d] shadow-[0_0_14px_rgba(198,164,125,0.8)] motion-safe:animate-pulse" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4b58f] motion-safe:animate-pulse sm:text-sm">
            Niebawem otwieramy
          </p>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#c6a47d] shadow-[0_0_14px_rgba(198,164,125,0.8)] motion-safe:animate-pulse" />
        </div>

        <div className="mt-10 w-full max-w-lg border border-[#80613f]/50 bg-[#171a1b]/80 p-5 text-left shadow-2xl backdrop-blur-sm sm:p-7">
          <h2 className="text-center font-serif text-2xl text-[#f4f0e8] sm:text-3xl">
            Chcesz wiedzieć, kiedy startujemy?
          </h2>
          <p className="mt-2 text-center text-sm leading-6 text-[#b9b6b0]">
            Zostaw nam kontakt. Odeślemy jedną wiadomość, gdy społeczność będzie gotowa.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label htmlFor="launch-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#d4b58f]">
                Twoje imię
              </label>
              <input
                id="launch-name"
                name="name"
                autoComplete="given-name"
                maxLength={100}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jak mamy się do Ciebie zwracać?"
                className="h-12 w-full border border-[#5d554b] bg-[#0e1112] px-4 text-sm text-[#f4f0e8] outline-none transition focus:border-[#c6a47d] focus:ring-1 focus:ring-[#c6a47d]"
              />
            </div>

            <div>
              <label htmlFor="launch-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#d4b58f]">
                Adres e-mail
              </label>
              <input
                id="launch-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="twoj@email.pl"
                className="h-12 w-full border border-[#5d554b] bg-[#0e1112] px-4 text-sm text-[#f4f0e8] outline-none transition focus:border-[#c6a47d] focus:ring-1 focus:ring-[#c6a47d]"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[#b9b6b0]">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#c6a47d]"
              />
              <span>
                Wyrażam zgodę na przetwarzanie mojego imienia i adresu e-mail w celu jednorazowego
                powiadomienia mnie o uruchomieniu platformy Tata Na Baczności. Wiem, że mogę wycofać zgodę.
                {" "}
                <a href="/polityka-prywatnosci" className="text-[#d4b58f] underline underline-offset-2 hover:text-[#f4f0e8]">
                  Polityka prywatności
                </a>.
              </span>
            </label>

            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="launch-website">Nie wypełniaj tego pola</label>
              <input id="launch-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </div>

            <button
              type="submit"
              disabled={busy || !consent}
              className="flex h-12 w-full items-center justify-center border border-[#c6a47d] bg-[#a77b4c] px-5 text-xs font-bold uppercase tracking-[0.18em] text-[#111315] transition hover:bg-[#c6a47d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Zapisuję..." : "Powiadom mnie o starcie"}
            </button>
            <p aria-live="polite" role={state.kind === "error" ? "alert" : "status"} className={`min-h-5 text-center text-sm ${state.kind === "error" ? "text-red-300" : state.kind === "success" || state.kind === "already" ? "text-[#d4b58f]" : "text-transparent"}`}>
              {state.message || " "}
            </p>
          </form>
        </div>

        <div className="mt-12 h-px w-24 bg-gradient-to-r from-transparent via-[#a77b4c]/60 to-transparent" />
        <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-[#77736d]">
          Czuwaj nad tym, co naprawdę ważne
        </p>
      </section>
    </main>
  );
}
