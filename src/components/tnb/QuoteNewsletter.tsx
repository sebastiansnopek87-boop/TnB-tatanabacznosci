import { useState, type FormEvent } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import banner from "@/assets/banner.jpg.asset.json";

export function QuoteNewsletter() {
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    toast.success("Dziękujemy! Zapis potwierdzimy mailem.");
    setEmail("");
  }

  return (
    <section className="grid bg-surface-deep lg:grid-cols-[1.55fr_1fr]">
      <div className="relative isolate flex items-center overflow-hidden px-5 py-12 lg:px-10">
        <img
          src={banner.url}
          alt="Panorama gór o zachodzie słońca"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.132 0.01 58 / 0.95) 0%, oklch(0.132 0.01 58 / 0.7) 55%, oklch(0.132 0.01 58 / 0.45) 100%)",
          }}
        />
        <div className="border-l-2 border-gold pl-7">
          <p className="font-display text-[1.35rem] leading-[1.6] text-foreground sm:text-[1.6rem]">
            Nie musisz być żołnierzem, żeby być człowiekiem z zasadami.
            <br />
            Nie musisz mieć za sobą wyjątkowej historii, żeby mieć coś wartościowego do
            przekazania.
          </p>
          <p className="eyebrow mt-5 text-gold">Tata Na Baczności</p>
        </div>
      </div>

      <div className="flex items-center gap-6 px-5 py-10 lg:px-10">
        <Mail className="hidden h-10 w-10 shrink-0 text-foreground/80 sm:block" strokeWidth={1} />
        <div className="w-full">
          <h2 className="text-[0.82rem] uppercase tracking-[0.16em] text-gold">
            Bądź na bieżąco
          </h2>
          <p className="mt-2 text-[0.82rem] leading-[1.6] text-muted-foreground">
            Otrzymuj nowe materiały, zapowiedzi podcastów i ważne informacje.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Twój e-mail"
              aria-label="Twój e-mail"
              className="min-w-[12rem] flex-1 border border-border bg-background/60 px-4 py-3 text-[0.85rem] text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-6 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright"
            >
              Zapisz się
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
          <p className="mt-3 flex items-center gap-2 text-[0.75rem] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            Bez spamu. Tylko wartościowe treści.
          </p>
        </div>
      </div>
    </section>
  );
}
