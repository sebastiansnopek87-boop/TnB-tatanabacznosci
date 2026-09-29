import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/tnb/PageShell";
import { ConfirmDelete, Initial, PostCard } from "@/components/community/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX, createComment, deleteComment, fmtWhen, getPost, listComments, updateComment, type Comment } from "@/lib/community";
import { useUid } from "./spolecznosc.index";

export const Route = createFileRoute("/spolecznosc/$postId")({
  head: () => ({
    meta: [
      { title: "Dyskusja — Społeczność Tata Na Baczności" },
      { name: "description", content: "Post i dyskusja w społeczności Tata Na Baczności." },
      { property: "og:title", content: "Dyskusja — Tata Na Baczności" },
      { property: "og:description", content: "Post i dyskusja w społeczności." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Thread,
});

function Thread() {
  const { postId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uid = useUid();
  const post = useQuery({ queryKey: ["community-post", postId], queryFn: () => getPost(postId) });
  const comments = useQuery({ queryKey: ["community-comments", postId], queryFn: () => listComments(postId) });
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["community-post", postId] }); qc.invalidateQueries({ queryKey: ["community-comments", postId] }); qc.invalidateQueries({ queryKey: ["community"] }); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await createComment(postId, body); setBody(""); toast.success("Komentarz został dodany."); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }

  const p = post.data;
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-5 py-10 lg:py-14">
        <Link to="/spolecznosc" className="text-sm text-gold hover:underline">← Wróć do społeczności</Link>
        <div className="mt-6">
          {post.isLoading && <p className="text-sm text-muted-foreground">Wczytywanie…</p>}
          {post.error && <p role="alert" className="text-sm text-destructive">{(post.error as Error).message}</p>}
          {!post.isLoading && !post.error && !p && <p className="text-sm text-muted-foreground">Ten post nie istnieje lub został usunięty.</p>}
          {p && <PostCard key={`${p.updated_at}-${p.reactions}-${p.reacted}-${p.comments}`} post={p} uid={uid} full onChanged={refresh}
            onDeleted={() => navigate({ to: "/spolecznosc", replace: true })} />}
        </div>

        {p && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold uppercase text-foreground">Komentarze</h2>
            <div className="mt-5 space-y-4">
              {comments.isLoading && <p className="text-sm text-muted-foreground">Wczytywanie komentarzy…</p>}
              {comments.error && <p role="alert" className="text-sm text-destructive">{(comments.error as Error).message}</p>}
              {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">Brak komentarzy. Bądź pierwszy.</p>}
              {comments.data?.map((c) => <CommentItem key={`${c.id}-${c.updated_at}`} c={c} uid={uid} onChanged={refresh} />)}
            </div>
            {p.status === "published" ? (
              <form onSubmit={submit} className="mt-6 space-y-3">
                <label htmlFor="new-comment" className="eyebrow text-gold">Twój komentarz</label>
                <Textarea id="new-comment" rows={3} maxLength={COMMENT_MAX} value={body} onChange={(e) => setBody(e.target.value)} className="bg-background/60" />
                {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
                <Button type="submit" disabled={busy}>{busy ? "Dodawanie…" : "Dodaj komentarz"}</Button>
              </form>
            ) : <p className="mt-6 text-sm text-muted-foreground">Post jest ukryty — komentowanie jest wyłączone.</p>}
          </section>
        )}
      </div>
    </PageShell>
  );
}

function CommentItem({ c, uid, onChanged }: { c: Comment; uid: string | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); setEditing(false); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex gap-3 border-l border-gold/30 pl-4">
      <Initial name={c.author_name} />
      <div className="min-w-0 flex-1">
        <p className="text-sm"><span className="font-medium text-foreground">{c.author_name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{fmtWhen(c.created_at)}{c.updated_at !== c.created_at && " · edytowano"}</span></p>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea rows={3} maxLength={COMMENT_MAX} value={text} onChange={(e) => setText(e.target.value)} aria-label="Treść komentarza" />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => run(() => updateComment(c.id, text), "Zapisano komentarz.")}>Zapisz</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(c.body); }}>Anuluj</Button>
            </div>
          </div>
        ) : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{c.body}</p>}
        {uid === c.author_id && !editing && (
          <div className="mt-1 flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edytuj</Button>
            <ConfirmDelete label="komentarz" onConfirm={() => run(() => deleteComment(c.id), "Komentarz został usunięty.")} />
          </div>
        )}
      </div>
    </div>
  );
}
