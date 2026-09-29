import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { PostCard } from "@/components/community/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PAGE, POST_MAX, createPost, listPosts } from "@/lib/community";

export const Route = createFileRoute("/spolecznosc/")({
  head: () => ({
    meta: [
      { title: "Społeczność — Tata Na Baczności" },
      { name: "description", content: "Miejsce spotkań ojców: posty, rozmowy i wzajemne wsparcie." },
      { property: "og:title", content: "Społeczność — Tata Na Baczności" },
      { property: "og:description", content: "Miejsce spotkań ojców Tata Na Baczności." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Community,
});

export function useUid() {
  return useQuery({ queryKey: ["uid"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null }).data ?? null;
}

function Community() {
  const qc = useQueryClient();
  const uid = useUid();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useInfiniteQuery({
    queryKey: ["community", tab],
    queryFn: ({ pageParam }) => listPosts(pageParam, tab === "mine"),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length : undefined),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["community"] });
  const posts = feed.data?.pages.flat() ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await createPost(body); setBody(""); toast.success("Post został opublikowany."); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }

  return (
    <PageShell>
      <PageHeading eyebrow="Społeczność" title="Przy wspólnym ognisku" intro="Podziel się doświadczeniem, zadaj pytanie, wesprzyj innego ojca. Rozmawiamy z szacunkiem." />
      <div className="mx-auto max-w-3xl px-5 py-10 lg:py-14">
        <form onSubmit={submit} className="border border-gold/30 bg-card/60 p-5 sm:p-7">
          <label htmlFor="new-post" className="eyebrow text-gold">Nowy post</label>
          <Textarea id="new-post" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={POST_MAX}
            placeholder="Co chcesz powiedzieć innym ojcom?" className="mt-3 bg-background/60" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.trim().length} / {POST_MAX}</span>
            <Button type="submit" disabled={busy} className="uppercase tracking-[0.15em]">{busy ? "Publikowanie…" : "Opublikuj"}</Button>
          </div>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
        </form>

        <div className="mt-10 flex gap-2 border-b border-border/60" role="tablist">
          {(["all", "mine"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "all" ? "Wszystkie posty" : "Moje posty"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {feed.isLoading && <p className="text-sm text-muted-foreground">Wczytywanie postów…</p>}
          {feed.error && (
            <div role="alert" className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm">
              {(feed.error as Error).message} <button className="ml-2 text-gold underline" onClick={() => feed.refetch()}>Spróbuj ponownie</button>
            </div>
          )}
          {!feed.isLoading && !feed.error && posts.length === 0 && (
            <p className="border border-dashed border-border/60 px-5 py-10 text-center text-sm text-muted-foreground">
              {tab === "all" ? "Nie ma jeszcze żadnych postów. Napisz pierwszy." : "Nie opublikowałeś jeszcze żadnego posta."}
            </p>
          )}
          {posts.map((p) => <PostCard key={`${p.id}-${p.updated_at}-${p.reactions}-${p.reacted}`} post={p} uid={uid} onChanged={refresh} />)}
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
