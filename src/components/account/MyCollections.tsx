import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listMyPurchases } from "@/lib/orders.functions";
import { listMySaved, setSaved } from "@/lib/article-interactions";
import { articleImageUrl, fmtArticleDate, articleCategoriesQuery } from "@/lib/articles";
export function MyPurchases() {
  const fn = useServerFn(listMyPurchases);
  const q = useQuery({ queryKey: ["my-purchases"], queryFn: () => fn() });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <p className="text-sm text-destructive">Nie udało się wczytać materiałów.</p>;
  if (!q.data?.length) return <p className="text-sm leading-relaxed text-muted-foreground">Nie masz jeszcze zakupionych materiałów. Znajdziesz je w <Link to="/biblioteka" className="text-gold underline">Bibliotece</Link>.</p>;
  return (
    <ul className="space-y-3">
      {q.data.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0">
          <span className="min-w-0 break-words text-sm text-foreground">{p.title}</span>
          <Link to="/biblioteka/$slug" params={{ slug: p.slug }} className="text-[0.7rem] uppercase tracking-[0.14em] text-gold">Otwórz</Link>
        </li>
      ))}
    </ul>
  );
}

export function MyArticles({ uid }: { uid: string }) {
  const q = useQuery({ queryKey: ["my-saved-articles", uid], queryFn: () => listMySaved(uid) });
  const cats = useQuery(articleCategoriesQuery());
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(id: string) {
    setBusy(id);
    try { await setSaved(id, uid, false); await q.refetch(); } catch { /* list stays unchanged */ } finally { setBusy(null); }
  }
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (q.error) return <p className="text-sm text-destructive">Nie udało się wczytać kolekcji.</p>;
  const items = q.data ?? [];
  if (!items.length) return <p className="text-sm leading-relaxed text-muted-foreground">Nie masz jeszcze zapisanych artykułów. Przejrzyj <Link to="/artykuly" className="text-gold underline">Artykuły</Link> i kliknij „Zapisz artykuł” pod tekstem, który chcesz mieć pod ręką.</p>;
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Zapisane artykuły: {items.length}</p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {items.map(({ article_id, article: a }) => (
          <li key={article_id} className="flex min-w-0 gap-4 border border-border/50 p-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden bg-surface-deep">
              {a?.cover ? <img src={articleImageUrl(a.id, a.cover, a.updated_at)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-display text-lg text-gold/40">TNB</div>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              {a ? (<>
                {a.category && <span className="text-[0.65rem] uppercase tracking-[0.14em] text-gold">{cats.data?.find((c) => c.slug === a.category)?.name}</span>}
                <span className="break-words text-sm font-medium text-foreground">{a.title}</span>
                <span className="text-xs text-muted-foreground">{fmtArticleDate(a.published_at)}</span>
              </>) : <span className="text-sm text-muted-foreground">Ten artykuł nie jest już dostępny publicznie.</span>}
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2">
                {a && <Link to="/artykuly/$slug" params={{ slug: a.slug }} className="text-[0.7rem] uppercase tracking-[0.14em] text-gold">Czytaj artykuł</Link>}
                <Button variant="ghost" size="sm" disabled={busy === article_id} onClick={() => remove(article_id)} className="h-auto px-0 py-1 text-xs text-muted-foreground hover:text-destructive">Usuń z kolekcji</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

