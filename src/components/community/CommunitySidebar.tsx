import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Layers, Plus, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JoinDialog } from "./JoinDialog";
import { NAV_SECTORS, SECTORS, searchCommunity, sectorCounts, type Sector } from "@/lib/community";

const CODE = [
  ["Szacunek ponad wszystko", "traktujemy innych z godnością, niezależnie od ich doświadczeń, poglądów i życiowej drogi."],
  ["Prawda bez pozowania", "rozmawiamy szczerze, bez udawania ideałów i kreowania fałszywego obrazu siebie."],
  ["Merytoryczna rozmowa", "wymieniamy argumenty, doświadczenia i perspektywy. Nie musimy się zgadzać, aby rozmawiać z szacunkiem."],
  ["Różne zdania, wspólna przestrzeń", "szanujemy odmienność poglądów i prawo każdego do własnego zdania."],
  ["Bez hejtu i agresji", "nie obrażamy, nie poniżamy, nie prowokujemy i nie atakujemy innych użytkowników."],
  ["Słowa mają znaczenie", "nie używamy wulgaryzmów, gróźb ani języka, który rani lub upokarza."],
  ["Wsparcie zamiast oceniania", "słuchamy, dzielimy się doświadczeniem i pomagamy bez narzucania innym własnej drogi."],
  ["Doświadczenie zamiast taniego coachingu", "nie pouczamy i nie składamy pustych obietnic. Dzielimy się tym, co sami przeżyliśmy i czego się nauczyliśmy."],
  ["Prywatność i zaufanie", "szanujemy osobiste historie i nie udostępniamy cudzych wypowiedzi poza społecznością bez zgody autora."],
  ["Odpowiedzialność za słowo", "pamiętamy, że po drugiej stronie ekranu jest człowiek."],
] as const;

const norm = (s: string) => s.toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

type Props = {
  signedIn: boolean; sector: Sector | null; onSector: (s: Sector | null) => void;
  onAuthor: (a: string) => void; onNewThread: () => void;
};

export function CommunitySidebar({ signedIn, sector, onSector, onAuthor, onNewThread }: Props) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [join, setJoin] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const counts = useQuery({ queryKey: ["community", "sector-counts"], queryFn: sectorCounts });
  const hits = useQuery({ queryKey: ["community", "search", dq, signedIn], queryFn: () => searchCommunity(dq), enabled: dq.length >= 2 });
  const sectorHits = dq.length >= 2 ? NAV_SECTORS.filter((k) => norm(SECTORS[k]).includes(norm(dq))) : [];
  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : null;
  const clear = () => { setQ(""); setDq(""); };

  const item = (key: Sector | null, label: string, n: number | null) => {
    const active = sector === key;
    return (
      <li key={key ?? "all"}>
        <button type="button" aria-pressed={active} onClick={() => onSector(key)}
          className={`flex w-full items-center justify-between border-l-2 px-3 py-2 text-left text-sm transition-colors ${active ? "border-gold bg-gold/10 text-gold" : "border-transparent text-foreground/85 hover:bg-card hover:text-foreground"}`}>
          <span>{label}</span>
          <span className={`text-xs tabular-nums ${active ? "text-gold" : "text-muted-foreground"}`}>{n ?? "–"}</span>
        </button>
      </li>
    );
  };

  return (
    <aside aria-label="Nawigacja społeczności" className="space-y-6">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} aria-label="Szukaj w społeczności"
          placeholder="Szukaj wątków, tematów, użytkowników…" className="bg-card/60 pl-9" />
        {dq.length >= 2 && (
          <div role="region" aria-label="Wyniki wyszukiwania" className="mt-2 max-h-96 overflow-auto border border-border/60 bg-card text-sm">
            {hits.isLoading && <p className="px-3 py-3 text-muted-foreground">Szukam…</p>}
            {hits.error && <p role="alert" className="px-3 py-3 text-destructive">{(hits.error as Error).message}</p>}
            {!hits.isLoading && !hits.error && sectorHits.length === 0 && (hits.data?.length ?? 0) === 0 && (
              <p className="px-3 py-3 text-muted-foreground">Brak wyników dla „{dq}”.</p>
            )}
            <ul>
              {sectorHits.map((k) => (
                <li key={k}><button type="button" onClick={() => { onSector(k); clear(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gold/10">
                  <Layers className="h-4 w-4 shrink-0 text-gold" /><span>Sektor: {SECTORS[k]}</span></button></li>
              ))}
              {hits.data?.filter((h) => h.kind === "user").map((h) => (
                <li key={`u-${h.label}`}><button type="button" onClick={() => { onAuthor(h.label); clear(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gold/10">
                  <User className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{h.label}</span><span className="ml-auto text-xs text-muted-foreground">{h.snippet} wpis.</span></button></li>
              ))}
              {hits.data?.filter((h) => h.kind === "post").map((h) => (
                <li key={h.id}><Link to="/spolecznosc/$postId" params={{ postId: h.id! }} className="flex gap-2 px-3 py-2 hover:bg-gold/10">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span className="min-w-0"><span className="line-clamp-2 break-words">{h.snippet}</span><span className="text-xs text-muted-foreground">{h.label}</span></span>
                </Link></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Button type="button" className="w-full uppercase tracking-[0.15em]" onClick={() => (signedIn ? onNewThread() : setJoin(true))}>
        <Plus className="mr-1.5 h-4 w-4" /> Zacznij nowy wątek
      </Button>
      <JoinDialog open={join} onOpenChange={setJoin} message="Aby rozpocząć nowy wątek, zaloguj się lub dołącz do społeczności Tata Na Baczności." />

      <nav aria-labelledby="sectors-h" className="border border-border/60 bg-card/40 py-4">
        <h2 id="sectors-h" className="eyebrow px-3 pb-3 text-gold">Sektory tematyczne</h2>
        {counts.error && <p role="alert" className="px-3 pb-2 text-xs text-destructive">Nie udało się pobrać liczników.</p>}
        <ul>
          {item(null, "Wszystkie wpisy", total)}
          {NAV_SECTORS.map((k) => item(k, SECTORS[k], counts.data ? counts.data[k] ?? 0 : null))}
        </ul>
        <p className="px-3 pt-3 text-[0.7rem] text-muted-foreground">Liczby pokazują wpisy publiczne.</p>
      </nav>

      <section aria-labelledby="code-h" className="border border-gold/30 bg-card/40 p-4">
        <h2 id="code-h" className="eyebrow text-gold">Kodeks postępowania</h2>
        <ol className="mt-3 space-y-2.5 text-[0.8rem] leading-[1.6] text-foreground/80">
          {CODE.map(([t, d], i) => (
            <li key={t} className="flex gap-2">
              <span className="w-5 shrink-0 font-display text-gold tabular-nums">{i + 1}.</span>
              <span><strong className="font-semibold text-foreground">{t}</strong> — {d}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
