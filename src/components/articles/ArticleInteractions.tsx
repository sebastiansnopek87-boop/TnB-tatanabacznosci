import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Flag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { ArticleCard } from "./ArticleCard";
import {
  ARTICLE_COMMENT_MAX, REACTIONS, addComment, deleteComment, editComment, getPoll, getStats, interactionError, listArticleComments,
  myState, relatedArticles, reportComment, setReaction, setSaved, vote, type ReactionType,
} from "@/lib/article-interactions";
import { articleCategoriesQuery, type Article } from "@/lib/articles";

const box = "mx-auto max-w-3xl border-t border-border/60 px-5 py-10 lg:px-0";
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0);
const fmt = (s: string) => new Date(s).toLocaleString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

function SignIn({ slug, label }: { slug: string; label: string }) {
  return <Link to="/auth" search={{ powrot: `/artykuly/${slug}` }} className="text-sm text-gold underline underline-offset-4 hover:text-gold-bright">{label}</Link>;
}

// Order under the article: reflection → poll → reactions → save → comments → related.
export function ArticleInteractions({ a }: { a: Article }) {
  const auth = useAuth();
  const uid = auth.user?.id ?? null;
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ["article-stats", a.id], queryFn: () => getStats(a.id) });
  const poll = useQuery({ queryKey: ["article-poll", a.id], queryFn: () => getPoll(a.id) });
  const mine = useQuery({ queryKey: ["article-mine", a.id, uid], queryFn: () => myState(a.id, uid!), enabled: !!uid });
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["article-stats", a.id] }); qc.invalidateQueries({ queryKey: ["article-mine", a.id] }); };
  async function run(fn: () => Promise<unknown>, ok?: string) {
    if (busy) return; setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(interactionError(e)); } finally { setBusy(false); refresh(); }
  }

  const p = poll.data; const votes = stats.data?.poll ?? {}; const totalVotes = Object.values(votes).reduce((x, y) => x + y, 0);
  const reacts = stats.data?.reactions ?? {}; const totalReacts = Object.values(reacts).reduce((x, y) => x + y, 0);

  return (
    <div className="overflow-x-hidden">
      {(a.reflection_question || a.discussion_question || p) && (
        <section className={box} aria-labelledby="stop">
          <h2 id="stop" className="font-display text-[1.9rem] font-semibold text-foreground">Zatrzymaj się na chwilę</h2>
          {a.reflection_question && (
            <div className="mt-5 border-l-2 border-gold pl-5">
              <p className="eyebrow text-gold">Pytanie do refleksji</p>
              <p className="mt-2 font-display text-[1.35rem] leading-snug text-foreground">{a.reflection_question}</p>
            </div>
          )}
          {a.discussion_question && (
            <div className="mt-6 border-l-2 border-border pl-5">
              <p className="eyebrow text-muted-foreground">Pytanie do dyskusji</p>
              <p className="mt-2 text-foreground/85">{a.discussion_question} <a href="#komentarze" className="text-gold underline underline-offset-4">Napisz w komentarzu</a></p>
            </div>
          )}
          {p && (
            <div className="mt-8 border border-border/60 bg-card/40 p-5">
              <p className="eyebrow text-muted-foreground">Ankieta · udział dobrowolny, nie ma złych odpowiedzi</p>
              <p className="mt-2 text-[1.05rem] text-foreground">{p.question}</p>
              <ul className="mt-4 space-y-2">
                {p.options.map((o, i) => {
                  const chosen = mine.data?.vote === i; const n = votes[i] ?? 0;
                  return (
                    <li key={i}>
                      <button type="button" disabled={!uid || !p.active || busy} onClick={() => run(() => vote(a.id, uid!, i), chosen ? undefined : "Zapisano Twój głos.")}
                        aria-pressed={chosen}
                        className={`relative w-full overflow-hidden border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${chosen ? "border-gold text-foreground" : "border-border/60 text-foreground/85 enabled:hover:border-gold/60"}`}>
                        {totalVotes > 0 && <span aria-hidden className="absolute inset-y-0 left-0 bg-gold/15" style={{ width: `${pct(n, totalVotes)}%` }} />}
                        <span className="relative flex items-center justify-between gap-3">
                          <span>{o}{chosen && <span className="ml-2 text-xs text-gold">(Twój wybór)</span>}</span>
                          {totalVotes > 0 && <span className="shrink-0 text-xs text-muted-foreground">{pct(n, totalVotes)}% · {n}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {totalVotes ? `Łącznie głosów: ${totalVotes}. Wyniki są anonimowe.` : "Nikt jeszcze nie zagłosował — wyniki pojawią się po pierwszym głosie."}
                {uid && mine.data?.vote != null && " Możesz zmienić swój głos, wybierając inną odpowiedź."}
                {!p.active && " Głosowanie jest zamknięte."}
              </p>
              {!uid && auth.status !== "loading" && <p className="mt-2"><SignIn slug={a.slug} label="Zaloguj się, aby zagłosować" /></p>}
            </div>
          )}
        </section>
      )}

      <section className={box} aria-labelledby="reakcje">
        <h2 id="reakcje" className="eyebrow text-muted-foreground">Twoja reakcja {totalReacts > 0 && <span className="normal-case tracking-normal">· łącznie {totalReacts}</span>}</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(REACTIONS) as ReactionType[]).map((t) => {
            const on = mine.data?.reaction === t;
            return (
              <button key={t} type="button" aria-pressed={on} disabled={!uid || busy}
                onClick={() => run(() => setReaction(a.id, uid!, on ? null : t))}
                className={`flex min-h-12 flex-col items-center justify-center border px-2 py-2 text-center text-sm transition-colors disabled:cursor-default ${on ? "border-gold bg-gold/10 text-gold" : "border-border/60 text-foreground/85 enabled:hover:border-gold/60"}`}>
                <span>{REACTIONS[t]}</span><span className="text-xs text-muted-foreground">{reacts[t] ?? 0}</span>
              </button>
            );
          })}
        </div>
        {uid ? <p className="mt-2 text-xs text-muted-foreground">Jedna reakcja na artykuł. Kliknij inną, aby ją zmienić, lub tę samą, aby ją usunąć.</p>
          : auth.status !== "loading" && <p className="mt-3"><SignIn slug={a.slug} label="Zaloguj się, aby zareagować" /></p>}

        <div className="mt-8">
          {uid ? (
            <Button variant={mine.data?.saved ? "default" : "outline"} disabled={busy || mine.isLoading}
              onClick={() => run(() => setSaved(a.id, uid, !mine.data?.saved), mine.data?.saved ? "Usunięto z kolekcji." : "Zapisano w „Moja kolekcja artykułów”.")}>
              {mine.data?.saved ? <><BookmarkCheck className="mr-2 h-4 w-4" />Zapisano</> : <><Bookmark className="mr-2 h-4 w-4" />Zapisz artykuł</>}
            </Button>
          ) : auth.status !== "loading" && (
            <Button asChild variant="outline"><Link to="/auth" search={{ powrot: `/artykuly/${a.slug}` }}><Bookmark className="mr-2 h-4 w-4" />Zaloguj się, aby zapisać</Link></Button>
          )}
        </div>
      </section>

      <Comments a={a} uid={uid} loading={auth.status === "loading"} onChange={refresh} />
      <Related a={a} />
    </div>
  );
}

function Comments({ a, uid, loading, onChange }: { a: Article; uid: string | null; loading: boolean; onChange: () => void }) {
  const list = useQuery({ queryKey: ["article-comments", a.id, !!uid], queryFn: () => listArticleComments(a.id, !!uid) });
  const [body, setBody] = useState(""); const [sending, setSending] = useState(false);
  const [edit, setEdit] = useState<{ id: string; body: string } | null>(null);
  const reload = () => { list.refetch(); onChange(); };
  async function send() {
    if (sending || body.trim().length < 2) return; setSending(true);
    try { await addComment(a.id, body); setBody(""); toast.success("Dodano komentarz."); reload(); } catch (e) { toast.error(interactionError(e)); } finally { setSending(false); }
  }
  async function act(fn: () => Promise<void>, ok: string) { try { await fn(); toast.success(ok); setEdit(null); reload(); } catch (e) { toast.error(interactionError(e)); } }
  const items = list.data ?? [];
  return (
    <section id="komentarze" className={box} aria-labelledby="kom">
      <h2 id="kom" className="font-display text-[1.7rem] font-semibold text-foreground">Komentarze {items.filter((c) => c.status === "visible").length > 0 && <span className="text-muted-foreground">({items.filter((c) => c.status === "visible").length})</span>}</h2>
      <p className="mt-2 text-sm text-muted-foreground">To miejsce na wymianę doświadczeń, nie na personalne ataki. Pisz o sobie i z szacunkiem dla innych. Nieodpowiedni komentarz możesz zgłosić — trafi do moderacji.</p>
      {uid ? (
        <div className="mt-5">
          <Textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, ARTICLE_COMMENT_MAX))} rows={4} placeholder="Podziel się swoim doświadczeniem…" aria-label="Treść komentarza" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.length}/{ARTICLE_COMMENT_MAX}</span>
            <Button onClick={send} disabled={sending || body.trim().length < 2}>{sending ? "Wysyłanie…" : "Dodaj komentarz"}</Button>
          </div>
        </div>
      ) : !loading && <p className="mt-5 border border-border/60 p-4 text-sm text-foreground/85">Komentarze mogą dodawać zalogowani członkowie TNB. <SignIn slug={a.slug} label="Zaloguj się, aby skomentować" /></p>}
      <ul className="mt-8 space-y-4">
        {list.isLoading && <li className="text-sm text-muted-foreground">Wczytywanie komentarzy…</li>}
        {!list.isLoading && !items.length && <li className="text-sm text-muted-foreground">Nie ma jeszcze komentarzy. Możesz być pierwszy.</li>}
        {items.map((c) => {
          const own = !!uid && c.author_id === uid;
          return (
            <li key={c.id} className="border border-border/60 bg-card/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{c.author_name}</span>
                <span className="text-xs text-muted-foreground">{fmt(c.created_at)}{c.updated_at !== c.created_at && " · edytowano"}</span>
              </div>
              {c.status === "hidden" && <p className="mt-1 text-xs text-destructive">Komentarz ukryty przez moderację — widzisz go tylko Ty.</p>}
              {edit?.id === c.id ? (
                <div className="mt-3">
                  <Textarea value={edit.body} onChange={(e) => setEdit({ id: c.id, body: e.target.value.slice(0, ARTICLE_COMMENT_MAX) })} rows={3} aria-label="Edytuj komentarz" />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" disabled={edit.body.trim().length < 2} onClick={() => act(() => editComment(c.id, edit.body), "Zapisano zmiany.")}>Zapisz</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Anuluj</Button>
                  </div>
                </div>
              ) : <p className="mt-2 whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-foreground/85">{c.body}</p>}
              {uid && edit?.id !== c.id && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {own ? (<>
                    <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold" onClick={() => setEdit({ id: c.id, body: c.body })}><Pencil className="h-3 w-3" />Edytuj</button>
                    <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Usunąć ten komentarz?")) act(() => deleteComment(c.id), "Usunięto komentarz."); }}><Trash2 className="h-3 w-3" />Usuń</button>
                  </>) : (
                    <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold" onClick={() => { const r = prompt("Dlaczego zgłaszasz ten komentarz? (opcjonalnie)"); if (r !== null) act(() => reportComment(c.id, r), "Dziękujemy. Zgłoszenie trafiło do moderacji."); }}><Flag className="h-3 w-3" />Zgłoś</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Related({ a }: { a: Article }) {
  const rel = useQuery({ queryKey: ["article-related", a.id], queryFn: () => relatedArticles(a.id, a.category) });
  const cats = useQuery(articleCategoriesQuery());
  if (!rel.data?.length) return null;
  return (
    <section className="mx-auto max-w-6xl border-t border-border/60 px-5 py-12 lg:px-14" aria-labelledby="rel">
      <h2 id="rel" className="font-display text-[1.7rem] font-semibold text-foreground">Przeczytaj także</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rel.data.map((r) => <ArticleCard key={r.id} a={r} category={cats.data?.find((c) => c.slug === r.category)?.name} />)}
      </div>
    </section>
  );
}
