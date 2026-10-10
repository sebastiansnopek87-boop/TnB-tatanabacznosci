import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getPublicChannel, listVideos, listInstagram, submitVoiceStory, storySchema } from "@/lib/voice.functions";
import { ytThumb } from "@/lib/voice";
import { fmtDay } from "@/lib/podcast";
import { usePlatformSettings } from "@/hooks/use-platform-settings";

const BTN = "inline-flex items-center gap-2 border border-gold/70 px-5 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold/10";
const SOLID = "inline-flex items-center gap-2 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright disabled:opacity-60";

function Heading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
      <h2 className="mt-2 font-display text-2xl font-semibold uppercase text-foreground sm:text-3xl">{title}</h2>
    </div>
  );
}

const fmtLen = (sec: number | null) => {
  if (!sec) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
const PAGE = 12;

function useChannelUrl() {
  const yt = usePlatformSettings().data?.social_youtube;
  const ch = useQuery({ queryKey: ["voice-channel"], queryFn: () => getPublicChannel(), staleTime: 300_000 });
  return yt || ch.data?.url || null;
}

export function WatchSection({ selected, autoplay }: { selected?: string | null; autoplay?: number } = {}) {
  const v = useQuery({ queryKey: ["voice-videos"], queryFn: () => listVideos() });
  const channel = useChannelUrl();
  const [sel, setSel] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const [shown, setShown] = useState(PAGE);
  // the unified list ("OBEJRZYJ") drives the one existing player
  useEffect(() => { if (selected) { setSel(selected); setPlay(true); } }, [selected, autoplay]);
  const all = (v.data ?? []).filter((x) => !!x.youtube_id); // external-link materials open in a new tab, never embed
  if (!all.length && !channel) return null;
  const cur = all.find((x) => x.id === sel) ?? all[0];
  return (
    <section aria-labelledby="ogladaj" className="border-t border-border/60 px-5 py-12 lg:px-14">
      <div id="ogladaj"><Heading eyebrow="YouTube" title="Oglądaj" /></div>
      {cur ? (
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="relative aspect-video w-full overflow-hidden border border-border/60 bg-surface-deep">
              <iframe key={(cur.youtube_id ?? "") + (play ? "1" : "0")} title={cur.title}
                src={`https://www.youtube-nocookie.com/embed/${cur.youtube_id ?? ""}?rel=0&modestbranding=1${play ? "&autoplay=1" : ""}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="absolute inset-0 h-full w-full" />
            </div>
            <h3 className="mt-5 break-words font-display text-2xl font-semibold uppercase leading-tight text-foreground">{cur.title}</h3>
            <p className="mt-2 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">{fmtDay(cur.published_at ?? cur.published_on)}{fmtLen(cur.duration_seconds) && ` · ${fmtLen(cur.duration_seconds)}`}</p>
            {cur.description && <p className="mt-4 line-clamp-6 whitespace-pre-line break-words text-[0.95rem] leading-[1.75] text-foreground/80">{cur.description}</p>}
          </div>
          <div className="min-w-0 border border-border/60 bg-card">
            <p className="border-b border-border/60 px-4 py-3 text-[0.7rem] uppercase tracking-[0.14em] text-gold">Najnowsze materiały</p>
            <ul className="max-h-[560px] overflow-y-auto" aria-label="Lista materiałów wideo">
              {all.slice(0, shown).map((x) => {
                const on = x.id === cur.id;
                return (
                  <li key={x.id}>
                    <button type="button" aria-current={on ? "true" : undefined} onClick={() => { setSel(x.id); setPlay(true); }}
                      className={`flex w-full gap-3 border-l-2 p-3 text-left transition-colors ${on ? "border-gold bg-foreground/10" : "border-transparent hover:bg-foreground/5"}`}>
                      <span className="relative w-32 shrink-0">
                        <img src={x.thumbnail_url || (x.youtube_id ? ytThumb(x.youtube_id) : "")} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                        {fmtLen(x.duration_seconds) && <span className="absolute bottom-1 right-1 bg-surface-deep/90 px-1 text-[0.65rem] text-foreground">{fmtLen(x.duration_seconds)}</span>}
                      </span>
                      <span className="min-w-0">
                        <span className={`line-clamp-2 break-words text-sm leading-snug ${on ? "text-gold" : "text-foreground"}`}>{x.title}</span>
                        <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">{fmtDay(x.published_at ?? x.published_on)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown < all.length && (
                <li className="p-3"><button type="button" onClick={() => setShown((n) => n + PAGE)} className={`w-full justify-center ${BTN}`}>Pokaż więcej</button></li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-foreground/75">Materiały wideo znajdziesz na kanale YouTube.</p>
      )}
      {channel && <a href={channel} target="_blank" rel="noopener noreferrer" className={`mt-8 ${BTN}`}>Odwiedź kanał na YouTube <ArrowRight className="h-4 w-4" /></a>}
    </section>
  );
}

export function ListenSection() {
  const sp = usePlatformSettings().data?.social_spotify;
  if (!sp) return null;
  return (
    <section className="border-t border-border/60 px-5 py-12 lg:px-14">
      <Heading title="Słuchaj Głosu TNB" />
      <p className="mt-4 text-[0.95rem] text-foreground/80">Rozmowy i materiały audio znajdziesz również na Spotify.</p>
      <a href={sp} target="_blank" rel="noopener noreferrer" className={`mt-6 ${BTN}`}>Otwórz Spotify →</a>
    </section>
  );
}

function TikTokGlyph({ className }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.2 4.4 5 4.6" />
  </svg>);
}
function SpotifyGlyph({ className }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5" /><path d="M7 9.3c3.4-1 7.2-.7 10 .9" /><path d="M7.6 12.4c2.9-.8 5.9-.5 8.3.8" /><path d="M8.3 15.3c2.3-.6 4.5-.4 6.4.6" />
  </svg>);
}

function ChannelCard({ href, name, line, cta, icon, deco }: { href: string; name: string; line: string; cta: string; icon: React.ReactNode; deco: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-border/70 bg-surface-deep p-7 shadow-[0_30px_60px_-30px_oklch(0_0_0/0.8)] transition-all duration-500 hover:-translate-y-0.5 hover:border-gold/60 sm:min-h-[300px] sm:p-10">
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,oklch(0.815_0.105_80/0.10),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
      {deco}
      <div className="relative flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center border border-gold/40 text-gold transition-colors group-hover:border-gold">{icon}</span>
        <span className="eyebrow text-muted-foreground">Głos TNB</span>
      </div>
      <div className="relative">
        <p className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-foreground sm:text-5xl">{name}</p>
        <p className="mt-3 text-[0.78rem] uppercase tracking-[0.22em] text-foreground/75">{line}</p>
        <span className="mt-7 inline-flex items-center gap-2 border-b border-gold/60 pb-1 text-[0.75rem] uppercase tracking-[0.2em] text-gold">{cta} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></span>
      </div>
    </a>
  );
}

const EQ = [30, 55, 40, 75, 50, 90, 60, 35, 70, 45, 85, 55, 30, 65, 40];

export function ChannelsSection() {
  const s = usePlatformSettings().data;
  const tt = s?.social_tiktok, sp = s?.social_spotify;
  if (!tt && !sp) return null;
  return (
    <section className="border-t border-border/60 px-5 py-12 lg:px-14 lg:py-16">
      <Heading title="Tata Na Baczności w sieci" />
      <p className="mt-4 max-w-2xl text-[0.95rem] leading-[1.75] text-foreground/80">Nie wszystko, co tworzę, powstaje w jednym miejscu.</p>
      <div className={`mt-10 grid gap-5 ${tt && sp ? "md:grid-cols-2" : ""}`}>
        {tt && <ChannelCard href={tt} name="TikTok" line="Krótkie formy. Mocne myśli." cta="Zobacz" icon={<TikTokGlyph className="h-6 w-6" />}
          deco={<span aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 font-display text-[11rem] font-semibold leading-none text-foreground/[0.03] transition-transform duration-700 group-hover:-translate-y-2">60″</span>} />}
        {sp && <ChannelCard href={sp} name="Spotify" line="Posłuchaj. Zatrzymaj się. Pomyśl." cta="Słuchaj" icon={<SpotifyGlyph className="h-6 w-6" />}
          deco={<span aria-hidden className="pointer-events-none absolute bottom-8 right-8 flex h-24 items-end gap-1.5 opacity-[0.14] transition-opacity duration-500 group-hover:opacity-25">
            {EQ.map((h, i) => <span key={i} className="w-1 bg-gold" style={{ height: `${h}%` }} />)}
          </span>} />}
      </div>
    </section>
  );
}

export function InstagramSection() {
  const q = useQuery({ queryKey: ["voice-instagram"], queryFn: () => listInstagram(), staleTime: 300_000 });
  const fallback = usePlatformSettings().data?.social_instagram;
  const d = q.data;
  const profile = d?.profileUrl || fallback || null;
  const items = d?.items ?? [];
  return (
    <section aria-labelledby="ig-title" className="border-t border-border/60 bg-surface-deep px-5 py-14 lg:px-14 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-gold">Obserwuj · Instagram</p>
          <h2 id="ig-title" className="mt-3 font-display text-4xl font-semibold uppercase leading-none tracking-[0.02em] text-foreground sm:text-5xl lg:text-6xl">Tata na baczności</h2>
        </div>
        {profile && <a href={profile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-b border-gold/60 pb-1 text-[0.78rem] uppercase tracking-[0.22em] text-gold hover:text-gold-bright">Obserwuj <span aria-hidden>↗</span></a>}
      </div>
      {items.length ? (
        <ul className="mt-10 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6 [&>li]:w-[calc(50%-4px)] [&>li]:shrink-0 sm:[&>li]:w-auto">
          {items.map((m, i) => (
            <li key={m.id} className={`snap-start ${i >= 4 ? "sm:hidden lg:block" : ""}`}>
              <a href={m.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Otwórz na Instagramie${m.caption ? `: ${m.caption.slice(0, 80)}` : ""}`} className="group relative block aspect-[4/5] overflow-hidden bg-card">
                <img src={m.thumbnail_url!} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                <span aria-hidden className="absolute inset-0 bg-surface-deep/0 transition-colors duration-500 group-hover:bg-surface-deep/35" />
                {m.product_type === "REELS" && <span className="absolute left-2 top-2 bg-surface-deep/75 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-gold">Reel</span>}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 border border-border/60 px-6 py-14 text-center">
          <p className="font-display text-2xl font-semibold uppercase text-foreground">Instagram</p>
          <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[0.95rem] leading-[1.75] text-foreground/75">{"Tutaj pojawią się najnowsze materiały\nz profilu TATA NA BACZNOŚCI."}</p>
        </div>
      )}
    </section>
  );
}

type F = { name: string; email: string; phone: string; about: string; topic: string; story: string; why: string; profile_url: string; consent: boolean };
const EMPTY: F = { name: "", email: "", phone: "", about: "", topic: "", story: "", why: "", profile_url: "", consent: false };
const INPUT = "mt-2 w-full border border-border bg-surface-deep px-3 py-2.5 text-[0.95rem] text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none";

export function StorySection() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<F>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<keyof F, string>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [hp, setHp] = useState("");
  const started = useRef(0);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setFail(null);
    const r = storySchema.safeParse(f);
    if (!r.success) {
      const m: Partial<Record<keyof F, string>> = {};
      for (const i of r.error.issues) { const k = i.path[0] as keyof F; if (!m[k]) m[k] = i.message; }
      setErrs(m); return;
    }
    setErrs({}); setBusy(true);
    try { await submitVoiceStory({ data: { ...r.data, website: hp, elapsedMs: Date.now() - started.current } }); setDone(true); }
    catch (x) { setFail(x instanceof Error && x.message.includes("antyspam") ? "Zgłoszenie zostało wysłane zbyt szybko. Spróbuj ponownie za chwilę." : "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę."); }
    finally { setBusy(false); }
  }

  const field = (k: keyof F, label: string, ph: string, req = false, area = 0, type = "text") => (
    <label className="block">
      <span className="text-[0.72rem] uppercase tracking-[0.14em] text-foreground/85">{label}{req && " *"}</span>
      {area ? <textarea rows={area} value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} className={INPUT} aria-invalid={!!errs[k]} />
        : <input type={type} value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} className={INPUT} aria-invalid={!!errs[k]} />}
      {errs[k] && <span className="mt-1 block text-sm text-destructive">{errs[k]}</span>}
    </label>
  );

  return (
    <section id="opowiedz" className="border-t border-border/60 px-5 py-12 lg:px-14 lg:py-16">
      <div className="max-w-3xl">
        <Heading title="Masz historię, którą warto opowiedzieć?" />
        {done ? (
          <div role="status" className="mt-6 border border-gold/50 bg-surface-deep p-6">
            <p className="flex items-center gap-2 font-display text-xl font-semibold uppercase text-gold"><CheckCircle2 className="h-5 w-5" />Twoja historia do nas dotarła.</p>
            <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-[1.75] text-foreground/85">{"Dzięki za zaufanie.\n\nPrzeczytam Twoje zgłoszenie. Jeśli uznam, że jest przestrzeń na rozmowę, skontaktuję się z Tobą."}</p>
          </div>
        ) : (<>
          <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-[1.75] text-foreground/80">
            {"Nie szukam ludzi, którzy mają gotowe recepty na życie.\nSzukam ludzi, którzy coś przeszli, coś zrozumieli albo są właśnie w drodze.\n\nJeżeli masz historię, doświadczenie albo temat, którym chciałbyś podzielić się z innymi — opowiedz mi o tym."}
          </p>
          {!open ? (
            <button type="button" onClick={() => { setOpen(true); started.current = Date.now(); }} className={`mt-6 ${SOLID}`}>Opowiedz swoją historię →</button>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
              <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
              <div className="grid gap-5 sm:grid-cols-2">
                {field("name", "Imię i nazwisko", "Jak mam się do Ciebie zwracać?", true)}
                {field("email", "Adres e-mail", "Na ten adres odpowiem w sprawie zgłoszenia.", true, 0, "email")}
              </div>
              {field("phone", "Numer telefonu", "Opcjonalnie", false, 0, "tel")}
              {field("about", "Kim jesteś / czym się zajmujesz?", "Kilka słów o Tobie.", false, 3)}
              {field("topic", "O czym chciałbyś porozmawiać?", "Jaki temat chciałbyś poruszyć podczas rozmowy?", true, 3)}
              {field("story", "Twoja historia", "Opowiedz krótko, co doprowadziło Cię do miejsca, w którym jesteś dzisiaj.", true, 7)}
              {field("why", "Dlaczego właśnie ta historia powinna wybrzmieć?", "Co Twoim zdaniem może dać drugiemu człowiekowi?", false, 4)}
              {field("profile_url", "Link do Twojego profilu / strony", "Opcjonalnie — Instagram, Facebook, YouTube, LinkedIn, własna strona itd.")}
              <label className="flex items-start gap-3 text-[0.95rem] text-foreground/85">
                <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 h-4 w-4 accent-gold" />
                <span>Tak, proszę o kontakt w sprawie mojego zgłoszenia. * <a href="/polityka-prywatnosci" className="text-gold underline">Polityka prywatności</a></span>
              </label>
              {errs.consent && <p className="text-sm text-destructive">{errs.consent}</p>}
              {fail && <p className="text-sm text-destructive">{fail}</p>}
              <button type="submit" disabled={busy} className={SOLID}>{busy ? "Wysyłanie…" : "Wyślij zgłoszenie →"}</button>
            </form>
          )}
        </>)}
      </div>
    </section>
  );
}
