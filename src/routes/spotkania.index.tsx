import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Video, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/tnb/PageShell";
import { listMeetings } from "@/lib/meetings.functions";
import { MeetingBadges } from "@/components/meetings/MeetingBadges";
import { fmtWhen, isPast, meetingImage, regState, type PublicMeeting } from "@/lib/meetings";

const TITLE = "Spotkania TNB — Tata Na Baczności";
const DESC = "Spotkania online, spotkania na żywo i rozmowy 1:1 — miejsce na rozmowę i wspólnie spędzony czas ojców ze społeczności TNB.";

export const Route = createFileRoute("/spotkania/")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Meetings,
});

const CATS = [
  { icon: Video, title: "Webinary online", text: "Rozmowy z Sebastianem, spotkania tematyczne i dyskusje z gośćmi na żywo przez internet. Do pokoju dołączysz z poziomu platformy — tylko po potwierdzeniu udziału." },
  { icon: MapPin, title: "Spotkania LIVE", text: "Spotkania w realnych miejscach — przy stole, na sali albo na szlaku. Wymagają osobistej obecności; miejsce, punkt zbiórki i zasady znajdziesz w opisie." },
];

function Meetings() {
  const q = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings() });
  const upcoming = (q.data ?? []).filter((m) => !isPast(m) && !m.cancelled);
  const cancelled = (q.data ?? []).filter((m) => !isPast(m) && m.cancelled);
  const past = (q.data ?? []).filter(isPast).reverse();

  return (
    <PageShell>
      <section className="border-b border-border/60 px-5 py-14 lg:px-14 lg:py-20">
        <p className="eyebrow text-gold">Spotkajmy się naprawdę</p>
        <h1 className="mt-4 font-display text-[2.6rem] font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-[3.4rem]">Spotkania TNB</h1>
        <p className="mt-6 max-w-2xl text-[0.95rem] leading-[1.75] text-foreground/80">
          Zapraszamy do rozmowy i wspólnie spędzonego czasu — przy ekranie, w terenie albo w cztery oczy. Wybierz formę, która jest Ci najbliższa.
        </p>
      </section>

      <div className="mx-auto max-w-[1200px] space-y-14 px-5 py-12 lg:px-14">
        <div className="grid gap-5 md:grid-cols-3">
          {CATS.map((c) => (
            <div key={c.title} className="border border-border/60 bg-card p-6">
              <c.icon className="h-6 w-6 text-gold" />
              <h2 className="mt-4 font-display text-xl font-semibold uppercase text-foreground">{c.title}</h2>
              <p className="mt-3 text-sm leading-[1.7] text-foreground/75">{c.text}</p>
            </div>
          ))}
          <div className="flex flex-col border border-gold/50 bg-card p-6">
            <MessageCircle className="h-6 w-6 text-gold" />
            <h2 className="mt-4 font-display text-xl font-semibold uppercase text-foreground">Rozmowy 1:1</h2>
            <p className="mt-3 text-sm leading-[1.7] text-foreground/75">
              Bezpłatna, poufna rozmowa z Sebastianem — 30 minut, jeden na jeden. Wybierz dogodny termin z kalendarza.
            </p>
            <Link to="/spotkania/rozmowa-1-1" className="mt-5 inline-block self-start bg-gold px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Umów rozmowę</Link>
          </div>
        </div>

        <section>
          <h2 className="font-display text-3xl font-semibold uppercase text-foreground">Nadchodzące spotkania</h2>
          <div className="mt-6">
            {q.isLoading ? <p className="text-sm text-muted-foreground">Ładowanie spotkań…</p>
              : q.error ? <p className="text-sm text-destructive">Nie udało się wczytać spotkań. Odśwież stronę.</p>
              : !upcoming.length ? (
                <div className="border border-gold/40 bg-surface-deep p-8 text-center">
                  <p className="font-display text-2xl font-semibold uppercase text-foreground">Brak zaplanowanych spotkań</p>
                  <p className="mt-3 text-sm text-foreground/70">Nowe terminy pojawią się tutaj, gdy tylko je ogłosimy. Do tego czasu zapraszamy do rozmowy 1:1.</p>
                </div>
              ) : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}</div>}
          </div>
        </section>

        {cancelled.length > 0 && (
          <section>
            <h2 className="font-display text-3xl font-semibold uppercase text-foreground">Odwołane</h2>
            <div className="mt-6 grid gap-6 opacity-80 sm:grid-cols-2 lg:grid-cols-3">{cancelled.map((m) => <MeetingCard key={m.id} m={m} />)}</div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="font-display text-3xl font-semibold uppercase text-foreground">Minione spotkania</h2>
            <div className="mt-6 grid gap-6 opacity-80 sm:grid-cols-2 lg:grid-cols-3">{past.map((m) => <MeetingCard key={m.id} m={m} />)}</div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function MeetingCard({ m }: { m: PublicMeeting }) {
  const img = meetingImage(m);
  const st = regState(m);
  return (
    <article className="flex min-w-0 flex-col border border-border/60 bg-card transition-colors hover:border-gold/50">
      {img && <img src={img} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="flex flex-1 flex-col p-5">
        <MeetingBadges m={m} />
        <h3 className="mt-3 break-words font-display text-xl font-semibold leading-tight text-foreground">{m.title}</h3>
        <p className="mt-2 flex items-center gap-2 text-xs text-foreground/70"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-gold" />{fmtWhen(m.starts_at)}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-foreground/70">{m.kind === "online" ? <><Video className="h-3.5 w-3.5 shrink-0 text-gold" />Online — bez wychodzenia z domu</> : <><MapPin className="h-3.5 w-3.5 shrink-0 text-gold" /><span className="break-words">Obecność osobista{m.venue_name || m.location ? ` · ${m.venue_name || m.location}` : ""}</span></>}</p>
        {m.summary && <p className="mt-3 line-clamp-4 break-words text-sm leading-[1.7] text-foreground/75">{m.summary}</p>}
        <div className="mt-auto pt-5">
          <p className={`text-xs ${st.canRegister ? "text-gold" : "text-muted-foreground"}`}>{st.label}</p>
          <Link to="/spotkania/$slug" params={{ slug: m.slug }} className="mt-4 block bg-gold px-4 py-2.5 text-center text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">
            {st.canRegister ? (m.kind === "online" ? "Zapisz się na webinar" : "Zapisz się na spotkanie LIVE") : m.has_recording ? "Szczegóły i nagranie" : "Szczegóły"}
          </Link>
        </div>
      </div>
    </article>
  );
}
