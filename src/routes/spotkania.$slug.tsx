import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin, Users, Mic, Mountain, Wallet } from "lucide-react";
import { MeetingBadges } from "@/components/meetings/MeetingBadges";
import { MyRegBox } from "@/components/meetings/MyRegBox";
import { PageShell } from "@/components/tnb/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { getMeeting, getMyRegistration, registerForMeeting } from "@/lib/meetings.functions";
import { DIFFICULTY, MEETING_KINDS, fmtTime, fmtWhen, freeSeats, meetingImage, regState, type MeetingDetail } from "@/lib/meetings";

export const Route = createFileRoute("/spotkania/$slug")({
  loader: async ({ params }) => ({ meeting: await getMeeting({ data: { slug: params.slug } }) }),
  head: ({ loaderData }) => {
    const m = loaderData?.meeting;
    if (!m) return { meta: [{ title: "Spotkanie niedostępne — Tata Na Baczności" }, { name: "robots", content: "noindex" }] };
    const t = `${m.title} — Spotkania TNB`;
    const d = m.summary || `${MEETING_KINDS[m.kind]} · ${fmtWhen(m.starts_at)}`;
    return { meta: [
      { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: MeetingPage,
});

const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function MeetingPage() {
  const { meeting: m } = Route.useLoaderData();
  if (!m) return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold uppercase text-foreground">Nie znaleziono spotkania</h1>
        <p className="mt-4 text-sm text-foreground/70">To spotkanie nie istnieje lub nie jest już dostępne.</p>
        <Link to="/spotkania" className="mt-6 inline-block text-gold underline">Wróć do spotkań</Link>
      </div>
    </PageShell>
  );
  const img = meetingImage(m);
  const free = freeSeats(m);
  return (
    <PageShell>
      <article className="mx-auto max-w-[900px] px-5 py-12 lg:py-16">
        <Link to="/spotkania" className="text-xs uppercase tracking-[0.14em] text-foreground/60 hover:text-gold">← Wszystkie spotkania</Link>
        <div className="mt-6"><MeetingBadges m={m} /></div>
        <h1 className="mt-3 break-words font-display text-[2.2rem] font-semibold uppercase leading-tight text-foreground sm:text-[2.8rem]">{m.title}</h1>
        {img && <img src={img} alt="" className="mt-8 aspect-[16/9] w-full border border-border/60 object-cover" />}
        {m.cancelled && <div role="alert" className="mt-6 border border-destructive/60 p-4 text-sm text-foreground"><p className="font-semibold uppercase">Spotkanie odwołane</p>{m.cancel_reason && <p className="mt-1 text-foreground/80">{m.cancel_reason}</p>}</div>}
        <dl className="mt-8 grid gap-4 border border-border/60 bg-card p-5 text-sm sm:grid-cols-3">
          <div><dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-gold" />Termin</dt>
            <dd className="mt-1 text-foreground">{fmtWhen(m.starts_at)}{m.ends_at ? ` – ${fmtTime(m.ends_at)}` : ""}</dd></div>
          <div><dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-gold" />Miejsce</dt>
            <dd className="mt-1 break-words text-foreground">{m.kind === "online" ? "Online — link otrzymają potwierdzeni uczestnicy"
              : <>{m.venue_name && <span className="block">{m.venue_name}</span>}{m.address ?? m.location ?? "Dokładne miejsce przekażemy potwierdzonym uczestnikom"}
                {m.map_url && <a href={m.map_url} target="_blank" rel="noopener noreferrer" className="block text-gold underline">Pokaż na mapie</a>}</>}</dd></div>
          <div><dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground"><Users className="h-3.5 w-3.5 text-gold" />Miejsca</dt>
            <dd className="mt-1 text-foreground">{free == null ? "Bez limitu" : `Wolne: ${free} z ${m.capacity}`}</dd></div>
        </dl>
        <Facts m={m} />
        {m.summary && <p className="mt-8 text-[1.05rem] leading-[1.75] text-foreground/90">{m.summary}</p>}
        <div className="mt-6 space-y-4 text-[0.95rem] leading-[1.8] text-foreground/80">{paras(m.description).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}</div>
        {m.rules.trim() && (
          <section className="mt-10 border-l-2 border-gold pl-5">
            <h2 className="font-display text-xl font-semibold uppercase text-foreground">Zasady uczestnictwa</h2>
            <div className="mt-3 space-y-3 text-sm leading-[1.75] text-foreground/80">{paras(m.rules).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
          </section>
        )}
        <Extra title="Potrzebne wyposażenie" text={m.equipment} />
        <Extra title="Wymagane przygotowanie" text={m.preparation} />
        <Extra title="Uwagi organizacyjne" text={m.org_notes} />
        <Extra title="Zasady rezygnacji" text={m.cancellation_policy} />
        {m.organizer_contact && <p className="mt-6 text-sm text-foreground/75">Kontakt do organizatora: <span className="break-words text-foreground">{m.organizer_contact}</span></p>}
        {m.recording_public && <a href={m.recording_public} target="_blank" rel="noopener noreferrer" className={`${btn} mt-8 inline-block`}>Odtwórz nagranie</a>}
        <Registration m={m} />
      </article>
    </PageShell>
  );
}

function Extra({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <section className="mt-8 border-l-2 border-gold/60 pl-5">
      <h2 className="font-display text-lg font-semibold uppercase text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-[1.75] text-foreground/80">{paras(text).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}</div>
    </section>
  );
}

function Facts({ m }: { m: MeetingDetail }) {
  const items: { icon: typeof Mic; label: string; value: string }[] = [];
  if (m.host) items.push({ icon: Mic, label: "Prowadzący", value: m.host });
  items.push({ icon: Wallet, label: "Udział", value: m.fee_info || "Bezpłatny" });
  if (m.is_outdoor) {
    if (m.route_length) items.push({ icon: Mountain, label: "Długość trasy", value: m.route_length });
    if (m.route_duration) items.push({ icon: Mountain, label: "Czas przejścia", value: m.route_duration });
    if (m.difficulty) items.push({ icon: Mountain, label: "Trudność", value: DIFFICULTY[m.difficulty] ?? m.difficulty });
    if (m.meeting_point) items.push({ icon: MapPin, label: "Punkt zbiórki", value: m.meeting_point });
  }
  return (
    <dl className="mt-4 grid gap-4 border border-border/60 bg-card p-5 text-sm sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label}><dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground"><it.icon className="h-3.5 w-3.5 text-gold" />{it.label}</dt>
          <dd className="mt-1 break-words text-foreground">{it.value}</dd></div>
      ))}
    </dl>
  );
}

const input = "w-full border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none";
const btn = "bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60";

function Registration({ m }: { m: MeetingDetail }) {
  const st = regState(m);
  const navigate = useNavigate();
  const regFn = useServerFn(registerForMeeting);
  const myFn = useServerFn(getMyRegistration);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(""); const [consent, setConsent] = useState(false); const [website, setWebsite] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user; setUserId(u?.id ?? null); if (!u) return;
      const md = (u.user_metadata ?? {}) as Record<string, string>;
      setName((v) => v || md["full_name"] || md["name"] || ""); setEmail((v) => v || u.email || "");
    });
  }, []);
  const mine = useQuery({ queryKey: ["my-meeting-reg", m.id, userId], queryFn: () => myFn({ data: { meetingId: m.id } }), enabled: !!userId });

  const box = "mt-12 border border-gold/40 bg-surface-deep p-6";
  if (mine.data && !(mine.data.status === "cancelled" && st.canRegister)) return <section className={box}><MyRegBox m={m} reg={mine.data} onChange={() => mine.refetch()} /></section>;
  if (!st.canRegister) return <section className={box}><p className="font-display text-xl font-semibold uppercase text-foreground">{st.label}</p><p className="mt-2 text-sm text-foreground/70">Zgłoszenia na to spotkanie nie są obecnie przyjmowane.</p></section>;
  if (m.requires_login && userId === null) {
    return (
      <section className={box}>
        <h2 className="font-display text-2xl font-semibold uppercase text-foreground">Zapisy dla członków TNB</h2>
        <p className="mt-3 text-sm text-foreground/75">Aby zapisać się na to spotkanie, zaloguj się lub dołącz do społeczności TNB.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/auth" search={{ powrot: `/spotkania/${m.slug}` }} className={btn}>Zaloguj się</Link>
          <Link to="/auth" search={{ tryb: "rejestracja", powrot: `/spotkania/${m.slug}` }} className="border border-border/60 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground/80">Dołącz do TNB</Link>
        </div>
      </section>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (name.trim().length < 3) return setErr("Podaj imię i nazwisko.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Podaj poprawny adres e-mail.");
    if (phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) return setErr("Podaj poprawny numer telefonu.");
    if (!consent) return setErr("Zaakceptuj wymagane zgody.");
    setBusy(true);
    try {
      const r = await regFn({ data: { meetingId: m.id, name, email, phone, message, consent: true, website, elapsedMs: Date.now() - started.current } });
      if ("error" in r) { setErr(r.error); setBusy(false); return; }
      navigate({ to: "/spotkania/zgloszenie/$token", params: { token: r.token } });
    } catch { setErr("Nie udało się wysłać zgłoszenia. Sprawdź dane i spróbuj ponownie."); setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className={`${box} space-y-4`}>
      <h2 className="font-display text-2xl font-semibold uppercase text-foreground">{m.kind === "online" ? "Zapisz się na webinar" : "Zapisz się na spotkanie LIVE"}</h2>
      <p className="text-xs text-muted-foreground">{m.requires_approval ? "Zgłoszenie zostanie rozpatrzone przez organizatora." : "Po wysłaniu zgłoszenia Twój udział zostanie potwierdzony."}{!m.requires_login && " Konto nie jest wymagane."}</p>
      <label className="block text-sm text-foreground/85">Imię i nazwisko *<input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" /></label>
      <label className="block text-sm text-foreground/85">Adres e-mail *<input className={`${input} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" /></label>
      <label className="block text-sm text-foreground/85">Numer telefonu (opcjonalnie)<input className={`${input} mt-1`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" /></label>
      <label className="block text-sm text-foreground/85">Wiadomość do organizatora (opcjonalnie)<textarea className={`${input} mt-1 min-h-24`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} /></label>
      <label className="absolute -left-[9999px]" aria-hidden="true">Strona www<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/80">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
        <span>Wyrażam zgodę na przetwarzanie moich danych w celu obsługi zgłoszenia na spotkanie. Akceptuję <Link to="/regulamin" className="text-gold underline">Regulamin</Link> i <Link to="/polityka-prywatnosci" className="text-gold underline">Politykę prywatności</Link>. *</span>
      </label>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <button type="submit" disabled={busy} className={btn}>{busy ? "Wysyłanie…" : m.kind === "online" ? "Zapisz się na webinar" : "Zapisz się na spotkanie LIVE"}</button>
    </form>
  );
}

