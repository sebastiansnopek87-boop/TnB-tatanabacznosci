import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Lock, UserRound, Wallet } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createConsultBooking, getConsultSlots } from "@/lib/consult.functions";
import { fmtDate, fmtHm, warsawYmd } from "@/lib/consult";

const TITLE = "Rozmowa 1:1 — Spotkania TNB";
const DESC = "Bezpłatna, poufna rozmowa jeden na jeden z Sebastianem. 30 minut, w terminie wybranym z kalendarza.";

export const Route = createFileRoute("/spotkania/rozmowa-1-1")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingPage,
});

const INTRO = [
  "Czasem wystarczy rozmowa. Bez oceniania, bez pouczania, bez gotowych recept na życie. Nie jestem coachem i nie zamierzam nikogo ustawiać do pionu. Jestem człowiekiem, który przeszedł swoją drogę i wie, że czasem warto po prostu zostać wysłuchanym.",
  "To bezpłatne, indywidualne spotkanie 1:1. Możesz porozmawiać o tym, co Cię obciąża, zadać pytanie, podzielić się doświadczeniem albo po prostu uporządkować myśli. Rozmowa pozostaje między nami. Twoja prywatność i wzajemny szacunek są podstawą tego spotkania.",
];
const FACTS = [
  { icon: Clock, t: "Czas rozmowy: 30 minut" },
  { icon: Wallet, t: "Koszt: bezpłatnie" },
  { icon: UserRound, t: "Forma: indywidualna rozmowa 1:1" },
  { icon: Lock, t: "Wymagana wcześniejsza rezerwacja" },
  { icon: CalendarDays, t: "Termin wybierasz z dostępnego kalendarza" },
];

type Form = { first_name: string; last_name: string; email: string; phone: string; topic: string; reason: string; question: string; consent: boolean; website: string };
const EMPTY: Form = { first_name: "", last_name: "", email: "", phone: "", topic: "", reason: "", question: "", consent: false, website: "" };

const WEEKDAY_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"];
const monthKey = (ymd: string) => ymd.slice(0, 7);
const shiftMonth = (key: string, amount: number) => {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthTitle = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)).toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const monthGrid = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const first = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - mondayOffset + index));
    return { date: date.toISOString().slice(0, 10), number: date.getUTCDate(), inMonth: date.getUTCMonth() === first.getUTCMonth() };
  });
};

function BookingPage() {
  const navigate = useNavigate();
  const slots = useQuery({ queryKey: ["consult-slots"], queryFn: () => getConsultSlots(), refetchInterval: 60_000 });
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const today = warsawYmd(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(today));
  const [step, setStep] = useState<"pick" | "form" | "review">("pick");
  const [f, setF] = useState<Form>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef(Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user; if (!u) return;
      const m = (u.user_metadata ?? {}) as { phone?: string; phone_prefix?: string; first_name?: string; last_name?: string };
      const phone = m.phone ? `${m.phone_prefix ?? ""} ${m.phone}`.trim() : "";
      setF((p) => ({ ...p, first_name: p.first_name || m.first_name || "", last_name: p.last_name || m.last_name || "", email: p.email || u.email || "", phone: p.phone || phone }));
    });
  }, []);

  const days = slots.data ?? [];
  const availableByDay = useMemo(() => new Map(days.map((available) => [available.date, available.slots])), [days]);
  const calendarDays = useMemo(() => monthGrid(visibleMonth), [visibleMonth]);
  const firstMonth = monthKey(today);
  const lastMonth = days.length ? monthKey(days[days.length - 1].date) : firstMonth;
  const daySlots = useMemo(() => days.find((d) => d.date === day)?.slots ?? [], [days, day]);
  useEffect(() => { if (slot && slots.data && !slots.data.some((d) => d.slots.includes(slot))) { setSlot(null); if (step !== "pick") setStep("pick"); setErr("Wybrany termin właśnie przestał być dostępny. Wybierz inny."); } }, [slots.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(): string | null {
    if (!f.first_name.trim()) return "Podaj imię.";
    if (!f.last_name.trim()) return "Podaj nazwisko.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return "Podaj poprawny adres e-mail.";
    if (f.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim())) return "Podaj poprawny numer telefonu.";
    if (f.topic.trim().length < 3) return "Podaj temat rozmowy (min. 3 znaki).";
    if (f.reason.trim().length < 3) return "Opisz krótko, co skłoniło Cię do umówienia rozmowy.";
    if (f.question.trim().length < 3) return "Podaj zagadnienie lub pytanie do rozmowy.";
    if (!f.consent) return "Potwierdź zapoznanie się z informacją o przetwarzaniu danych.";
    return null;
  }

  async function submit() {
    if (!slot || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await createConsultBooking({ data: { startsAt: slot, ...f, consent: true, elapsedMs: Date.now() - opened.current } });
      navigate({ to: "/spotkania/rezerwacja/$token", params: { token: r.token } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się zapisać rezerwacji.");
      slots.refetch();
      setBusy(false);
    }
  }

  const input = "w-full border border-border bg-surface-deep px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none";
  return (
    <PageShell>
      <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
        <Link to="/spotkania" className="text-xs uppercase tracking-[0.14em] text-foreground/60 hover:text-gold">← Spotkania TNB</Link>
        <p className="eyebrow mt-6 text-gold">Rozmowy 1:1</p>
        <h1 className="mt-4 font-display text-[2.4rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.2rem]">Umów rozmowę</h1>
        <div className="mt-8 max-w-2xl space-y-4 text-[0.98rem] leading-[1.8] text-foreground/85">{INTRO.map((p, i) => <p key={i}>{p}</p>)}</div>
        <ul className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
          {FACTS.map(({ icon: I, t }) => <li key={t} className="flex items-center gap-3 border border-border/60 bg-card px-4 py-3 text-sm text-foreground"><I className="h-4 w-4 shrink-0 text-gold" />{t}</li>)}
        </ul>
      </section>

      <div className="mx-auto max-w-[1000px] px-5 py-12 lg:py-16">
        {err && <p role="alert" className="mb-6 border border-destructive/60 bg-destructive/10 p-4 text-sm text-foreground">{err}</p>}

        {step === "pick" && (
          <section aria-labelledby="cal">
            <h2 id="cal" className="font-display text-2xl font-semibold uppercase text-foreground">1. Wybierz dzień i godzinę</h2>
            {slots.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Wczytywanie kalendarza…</p>
              : slots.error ? <p className="mt-4 text-sm text-destructive">Nie udało się wczytać kalendarza. Odśwież stronę.</p>
              : !days.length ? (
                <div className="mt-6 border border-gold/40 bg-surface-deep p-6 text-[0.95rem] leading-[1.75] text-foreground/85">
                  Obecnie nie ma udostępnionych terminów. Wróć wkrótce.
                </div>
              ) : (
                <div className="mt-6 max-w-3xl">
                  <div className="border border-border/70 bg-card p-3 sm:p-5">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                      <Button type="button" variant="outline" size="icon" disabled={visibleMonth <= firstMonth} onClick={() => { setVisibleMonth((current) => shiftMonth(current, -1)); setDay(null); setSlot(null); }} aria-label="Poprzedni miesiąc">
                        <ChevronLeft aria-hidden />
                      </Button>
                      <div className="min-w-0 text-center">
                        <h3 className="truncate font-display text-xl font-semibold text-foreground sm:text-2xl">{monthTitle(visibleMonth)}</h3>
                        {visibleMonth !== firstMonth && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-gold" onClick={() => { setVisibleMonth(firstMonth); setDay(null); setSlot(null); }}>Bieżący miesiąc</Button>}
                      </div>
                      <Button type="button" variant="outline" size="icon" disabled={visibleMonth >= lastMonth} onClick={() => { setVisibleMonth((current) => shiftMonth(current, 1)); setDay(null); setSlot(null); }} aria-label="Następny miesiąc">
                        <ChevronRight aria-hidden />
                      </Button>
                    </div>
                    <div className="mt-5 grid grid-cols-7 border-b border-border/60 pb-2 text-center text-[0.62rem] uppercase text-muted-foreground sm:text-xs">
                      {WEEKDAY_SHORT.map((weekday) => <span key={weekday}>{weekday}</span>)}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label={`Kalendarz: ${monthTitle(visibleMonth)}`}>
                      {calendarDays.map((cell) => {
                        const available = availableByDay.get(cell.date) ?? [];
                        const enabled = cell.inMonth && cell.date >= today && available.length > 0;
                        const selected = day === cell.date;
                        const isToday = cell.date === today;
                        return (
                          <Button
                            key={cell.date}
                            type="button"
                            variant="ghost"
                            disabled={!enabled}
                            aria-label={`${cell.date}${available.length ? `, wolne terminy: ${available.length}` : ", brak wolnych terminów"}`}
                            aria-pressed={selected}
                            onClick={() => { setDay(cell.date); setSlot(null); setErr(null); }}
                            className={`relative aspect-square h-auto min-h-9 w-full rounded-sm border p-0 text-xs tabular-nums sm:min-h-14 sm:text-sm ${!cell.inMonth ? "invisible" : selected ? "border-gold bg-gold text-primary-foreground hover:bg-gold-bright hover:text-primary-foreground" : enabled ? "border-gold/60 bg-gold/10 text-foreground hover:border-gold hover:bg-gold/20" : "border-transparent bg-transparent text-muted-foreground/45"} ${isToday && !selected ? "ring-1 ring-gold ring-offset-1 ring-offset-background" : ""}`}
                          >
                            <span>{cell.number}</span>
                            {enabled && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-gold sm:bottom-2" aria-hidden />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-border/60 pt-6">
                    <p className="eyebrow text-muted-foreground">Godzina rozpoczęcia</p>
                    {!day ? <p className="mt-3 text-sm text-muted-foreground">Wybierz dostępny dzień w kalendarzu.</p> : (
                      <>
                        <p className="mt-2 text-sm text-foreground">{fmtDate(`${day}T12:00:00Z`)}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {daySlots.map((s) => (
                            <Button key={s} type="button" variant={slot === s ? "default" : "outline"} onClick={() => setSlot(s)} aria-pressed={slot === s} className={`rounded-sm tabular-nums ${slot === s ? "bg-gold text-primary-foreground hover:bg-gold-bright" : "border-border"}`}>{fmtHm(s)}</Button>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">Godziny w czasie polskim. Czas rozmowy jest stały: 30 minut.</p>
                  </div>
                </div>
              )}
            {slot && (
              <div className="mt-8 border border-gold/40 bg-surface-deep p-5">
                <p className="eyebrow text-gold">Wybrany termin</p>
                <p className="mt-2 text-foreground"><span>{fmtDate(slot)}</span>, godz. {fmtHm(slot)}–{fmtHm(new Date(new Date(slot).getTime() + 30 * 60000).toISOString())} (30 minut)</p>
                <button type="button" onClick={() => { setStep("form"); setErr(null); }} className="mt-4 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Dalej — Twoje dane</button>
              </div>
            )}
          </section>
        )}

        {step === "form" && slot && (
          <section>
            <h2 className="font-display text-2xl font-semibold uppercase text-foreground">2. Twoje dane i opis rozmowy</h2>
            <p className="mt-2 text-sm text-muted-foreground"><span>{fmtDate(slot)}</span>, godz. {fmtHm(slot)} · 30 minut · <button type="button" className="text-gold underline" onClick={() => setStep("pick")}>zmień termin</button></p>
            <form className="mt-6 space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); const v = validate(); setErr(v); if (!v) setStep("review"); }}>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden />
              <div className="grid gap-4 sm:grid-cols-2">
                <L label="Imię *"><input className={input} value={f.first_name} maxLength={60} autoComplete="given-name" onChange={(e) => set("first_name", e.target.value)} /></L>
                <L label="Nazwisko *"><input className={input} value={f.last_name} maxLength={80} autoComplete="family-name" onChange={(e) => set("last_name", e.target.value)} /></L>
                <L label="Adres e-mail *"><input className={input} type="email" value={f.email} maxLength={254} autoComplete="email" onChange={(e) => set("email", e.target.value)} /></L>
                <L label="Numer telefonu (opcjonalnie)"><input className={input} type="tel" value={f.phone} maxLength={20} autoComplete="tel" onChange={(e) => set("phone", e.target.value)} /></L>
              </div>
              <L label="Temat rozmowy *"><input className={input} value={f.topic} maxLength={150} onChange={(e) => set("topic", e.target.value)} /></L>
              <L label="Co skłoniło Cię do umówienia rozmowy? *"><textarea className={`${input} min-h-28`} value={f.reason} maxLength={2000} onChange={(e) => set("reason", e.target.value)} /></L>
              <L label="Zagadnienie lub pytanie, które chcesz poruszyć *"><textarea className={`${input} min-h-28`} value={f.question} maxLength={2000} onChange={(e) => set("question", e.target.value)} /></L>
              <p className="border-l-2 border-gold pl-4 text-sm leading-relaxed text-foreground/80">
                Opis służy wyłącznie przygotowaniu się do rozmowy i nie będzie publicznie widoczny. Napisz tylko tyle, ile chcesz — nie musisz podawać szczegółów, którymi nie chcesz się dzielić.
              </p>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                <input type="checkbox" className="mt-1 accent-[var(--color-gold)]" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
                <span>Zapoznałem(-am) się z informacją o przetwarzaniu danych. Moje dane służą wyłącznie organizacji rozmowy. Szczegóły: <Link to="/polityka-prywatnosci" className="text-gold underline">Polityka prywatności</Link>. *</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Dalej — podsumowanie</button>
                <button type="button" onClick={() => setStep("pick")} className="border border-border px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground hover:border-gold">Wstecz</button>
              </div>
            </form>
          </section>
        )}

        {step === "review" && slot && (
          <section>
            <h2 className="font-display text-2xl font-semibold uppercase text-foreground">3. Sprawdź rezerwację</h2>
            <dl className="mt-6 grid gap-4 border border-border/60 bg-card p-5 text-sm sm:grid-cols-2">
              <R k="Data"><span>{fmtDate(slot)}</span></R>
              <R k="Godzina">{fmtHm(slot)}</R>
              <R k="Czas trwania">30 minut (bezpłatnie)</R>
              <R k="Imię i nazwisko">{f.first_name} {f.last_name}</R>
              <R k="E-mail">{f.email}</R>
              <R k="Telefon">{f.phone || "—"}</R>
              <div className="sm:col-span-2"><R k="Temat rozmowy">{f.topic}</R></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={submit} className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-50">{busy ? "Rezerwowanie…" : "Potwierdzam rezerwację"}</button>
              <button type="button" disabled={busy} onClick={() => setStep("form")} className="border border-border px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground hover:border-gold">Popraw dane</button>
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm text-foreground/90"><span>{label}</span>{children}</label>;
}
function R({ k, children }: { k: string; children: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-foreground">{children}</dd></div>;
}
