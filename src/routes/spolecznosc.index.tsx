import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { PostCard, SectorSelect, VisibilitySelect } from "@/components/community/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PAGE, POST_MAX, SORT_LABEL, createPost, listPosts, useUid, type Sector, type Sort, type Visibility } from "@/lib/community";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/spolecznosc/")({
  head: () => ({
    meta: [
      { title: "Społeczność — Tata Na Baczności" },
      { name: "description", content: "Społeczność Tata Na Baczności: wymiana doświadczeń, rozmowa i wzajemne wsparcie ojców. Przeczytaj publiczne wpisy i dołącz." },
      { property: "og:title", content: "Społeczność — Tata Na Baczności" },
      { property: "og:description", content: "Miejsce wymiany doświadczeń, rozmowy i wzajemnego wsparcia ojców." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Community,
});

const VALUES = [
  { t: "Czym jest", d: "Miejscem wymiany doświadczeń, rozmowy i wzajemnego wsparcia. Nie zamkniętym klubem, nie korporacyjnym portalem i nie miejscem, w którym jedna osoba poucza pozostałych." },
  { t: "Co nas łączy", d: "Szacunek, szczerość i odpowiedzialność. Mówimy o ojcostwie takim, jakie jest — z sukcesami, wątpliwościami i codziennością." },
  { t: "Dla kogo", d: "Dla ojców i tych, którzy się nimi stają — niezależnie od wieku dzieci i etapu życia. Każdy głos jest tu równie ważny." },
  { t: "Jak uczestniczyć", d: "Czytaj wpisy, komentuj, publikuj własne przemyślenia i reaguj na słowa innych. Wystarczy bezpłatne konto TNB." },
];

function Community() {
  const qc = useQueryClient();
  const { uid, ready } = useUid();
  const signedIn = !!uid;
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [body, setBody] = useState("");
  const [vis, setVis] = useState<Visibility>("community");
  const [sector, setSector] = useState<Sector>("ogolne");
  const [sort, setSort] = useState<Sort>("newest");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useInfiniteQuery({
    queryKey: ["community", signedIn ? tab : "public", uid, sort],
    queryFn: ({ pageParam }) => listPosts(pageParam, signedIn && tab === "mine", signedIn, sort),
    initialPageParam: 0,
    enabled: ready,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length : undefined),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["community"] });
  const posts = feed.data?.pages.flat() ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await createPost(body, vis, sector); setBody(""); setVis("community"); setSector("ogolne"); toast.success("Post został opublikowany."); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }

  return (
    <PageShell>
      <PageHeading eyebrow="Społeczność" title="Przy wspólnym ognisku" intro="Tata Na Baczności to miejsce wymiany doświadczeń, rozmowy i wzajemnego wsparcia ojców. Rozmawiamy z szacunkiem." />

      <section className="border-b border-border/60 px-5 py-12 lg:px-14 lg:py-16">
        <div className="mx-auto grid max-w-[1200px] gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.t} className="border-t border-gold/40 pt-5">
              <h2 className="font-display text-xl font-semibold uppercase tracking-[0.04em] text-gold">{v.t}</h2>
              <p className="mt-3 text-sm leading-[1.75] text-foreground/80">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 lg:py-14">
        {ready && (
          <section aria-labelledby="welcome" className="relative border border-gold/30 bg-card/60 px-6 py-10 text-center sm:px-10 sm:py-12">
            <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <h2 id="welcome" className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-foreground sm:text-4xl">
              {signedIn ? "Zacznij własną rozmowę." : "Rozmowy czekają na Ciebie."}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-[1.75] text-foreground/80">
              {signedIn ? "Podziel się doświadczeniem, zadaj pytanie albo wesprzyj innego ojca dobrym słowem." : "Zaloguj się, aby publikować, komentować i reagować."}
            </p>
            {!signedIn ? (
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline" className="min-w-40 uppercase tracking-[0.15em]"><Link to="/auth">Zaloguj się</Link></Button>
                <Button asChild className="min-w-40 uppercase tracking-[0.15em]"><Link to="/auth" search={{ tryb: "rejestracja" }}>Dołącz do nas</Link></Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7 text-left">
                <label htmlFor="new-post" className="eyebrow text-gold">Nowy post</label>
                <Textarea id="new-post" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={POST_MAX}
                  placeholder="Co chcesz powiedzieć innym ojcom?" className="mt-3 bg-background/60" />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div><label htmlFor="new-post-sector" className="mb-1.5 block text-xs text-muted-foreground">Sektor</label><SectorSelect id="new-post-sector" value={sector} onChange={setSector} /></div>
                  <div><label htmlFor="new-post-vis" className="mb-1.5 block text-xs text-muted-foreground">Widoczność</label><VisibilitySelect id="new-post-vis" value={vis} onChange={setVis} /></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{body.trim().length} / {POST_MAX}</span>
                  <Button type="submit" disabled={busy} className="uppercase tracking-[0.15em]">{busy ? "Publikowanie…" : "Opublikuj"}</Button>
                </div>
                {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
              </form>
            )}
          </section>
        )}

        <div className="mt-12 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h2 className="eyebrow text-gold">Feed rozmów</h2>
            {signedIn && (
              <div className="mt-3 flex gap-1" role="tablist">
                {(["all", "mine"] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`border-b-2 px-3 py-1 text-sm ${tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {t === "all" ? "Wszystkie posty" : "Moje posty"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-44" aria-label="Sortowanie"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(SORT_LABEL) as Sort[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="mt-6 space-y-5">
          {(!ready || feed.isLoading) && <p className="text-sm text-muted-foreground">Wczytywanie postów…</p>}
          {feed.error && (
            <div role="alert" className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm">
              {(feed.error as Error).message} <button className="ml-2 text-gold underline" onClick={() => feed.refetch()}>Spróbuj ponownie</button>
            </div>
          )}
          {ready && !feed.isLoading && !feed.error && posts.length === 0 && (
            <p className="border border-dashed border-border/60 px-5 py-10 text-center text-sm text-muted-foreground">
              {!signedIn ? "Nie ma jeszcze publicznych wpisów. Dołącz, aby czytać rozmowy społeczności." : tab === "all" ? "Nie ma jeszcze żadnych postów. Napisz pierwszy." : "Nie opublikowałeś jeszcze żadnego posta."}
            </p>
          )}
          {posts.map((p) => <PostCard key={`${p.id}-${p.updated_at}-${p.visibility}-${p.sector}-${p.reactions}-${p.reacted}-${p.comments}`} post={p} uid={uid} onChanged={refresh} />)}
          {!feed.hasNextPage && posts.length > 0 && <p className="pt-2 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">To już wszystkie wpisy</p>}
          {feed.hasNextPage && (
            <Button variant="outline" className="w-full" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
              {feed.isFetchingNextPage ? "Wczytywanie…" : "Pokaż starsze posty"}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
