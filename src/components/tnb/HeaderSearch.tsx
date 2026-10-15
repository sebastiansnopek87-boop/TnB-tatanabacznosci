import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listArticles } from "@/lib/articles";
import { listLibrary } from "@/lib/library";
import { listEpisodes } from "@/lib/podcast.functions";
import { listVideos } from "@/lib/voice.functions";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { Button } from "@/components/ui/button";

export function HeaderSearch({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const { visiblePath } = useModuleVisibility();
  const articles = visiblePath("/artykuly", "page");
  const library = visiblePath("/biblioteka", "page");
  const voice = visiblePath("/podcast", "page");
  const query = useQuery({
    queryKey: ["header-search", articles, library, voice],
    queryFn: async () => {
      const sources = await Promise.allSettled([
        articles ? listArticles() : Promise.resolve([]),
        library ? listLibrary({ q: "", category: null, access: null }) : Promise.resolve([]),
        voice ? listEpisodes() : Promise.resolve([]),
        voice ? listVideos() : Promise.resolve([]),
      ]);
      const [a, l, e, v] = sources;
      return {
        failed: sources.some(s => s.status === "rejected"),
        items: [
          ...(a?.status === "fulfilled" ? a.value.map(i => ({ title: i.title, description: i.excerpt, href: `/artykuly/${encodeURIComponent(i.slug)}`, source: "Artykuły" })) : []),
          ...(l?.status === "fulfilled" ? l.value.map(i => ({ title: i.title, description: i.summary, href: `/biblioteka/${encodeURIComponent(i.slug)}`, source: "Biblioteka" })) : []),
          ...(e?.status === "fulfilled" ? e.value.map(i => ({ title: i.title, description: i.summary, href: `/podcast/${encodeURIComponent(i.slug)}`, source: "Głos TNB" })) : []),
          ...(v?.status === "fulfilled" ? v.value.map(i => ({ title: i.title, description: i.description, href: i.external_url || "/podcast", source: "Głos TNB" })) : []),
        ],
      };
    },
    staleTime: 60_000,
  });
  const term = text.trim().toLocaleLowerCase("pl");
  const results = query.data?.items.filter(i => `${i.title} ${i.description}`.toLocaleLowerCase("pl").includes(term)) ?? [];
  return <section aria-label="Wyszukiwanie w TNB" className="mx-auto max-w-3xl px-5 py-5">
    <label className="relative block">
      <Search aria-hidden className="absolute left-3 top-3.5 h-5 w-5 text-gold" />
      <input autoFocus aria-label="Szukaj w TNB" value={text} onChange={e => setText(e.target.value)} maxLength={100} placeholder="Szukaj w TNB…" className="w-full border border-border bg-background py-3 pl-11 pr-3 text-foreground focus:border-gold focus:outline-none" />
    </label>
    <div aria-live="polite" className="mt-4 space-y-2">
      {query.isPending ? <p className="text-muted-foreground">Ładowanie materiałów…</p> : query.isError ? <><p>Nie udało się pobrać materiałów.</p><Button variant="outline" onClick={() => query.refetch()}>Spróbuj ponownie</Button></> : <>
        {query.data?.failed && <p className="text-sm text-muted-foreground">Część materiałów jest chwilowo niedostępna.</p>}
        {!term ? <div className="flex flex-wrap gap-4">{articles && <Link to="/artykuly" onClick={onClose} className="nav-link">Artykuły</Link>}{library && <Link to="/biblioteka" onClick={onClose} className="nav-link">Biblioteka</Link>}{voice && <Link to="/podcast" onClick={onClose} className="nav-link">Głos TNB</Link>}</div> : <>
          <p className="text-sm text-muted-foreground">Wyniki: {results.length}</p>
          {results.length === 0 && <p>Brak wyników dla „{text}”.</p>}
          {results.slice(0, 30).map((i, n) => <a key={`${i.href}-${n}`} href={i.href} onClick={onClose} className="block border-b border-border/60 py-3 hover:text-gold" {...(i.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}><span className="block text-xs text-gold">{i.source}</span><span className="block break-words">{i.title}</span></a>)}
        </>}
      </>}
    </div>
  </section>;
}