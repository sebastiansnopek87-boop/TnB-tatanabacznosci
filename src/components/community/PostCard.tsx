import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POST_MAX, VIS_LABEL, deletePost, fmtWhen, toggleReaction, updatePost, type Post, type Visibility } from "@/lib/community";

export function VisibilitySelect({ value, onChange, id }: { value: Visibility; onChange: (v: Visibility) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Visibility)}>
      <SelectTrigger id={id} className="w-full sm:w-60" aria-label="Widoczność posta"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="community">{VIS_LABEL.community}</SelectItem>
        <SelectItem value="public">{VIS_LABEL.public} — widoczny dla wszystkich</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-display text-lg font-semibold uppercase text-gold">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

export function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive">Usuń</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć {label}?</AlertDialogTitle>
          <AlertDialogDescription>Tej operacji nie można cofnąć.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Usuń</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PostCard({ post, uid, full, onChanged, onDeleted }: {
  post: Post; uid: string | null; full?: boolean; onChanged: () => void; onDeleted?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.body);
  const [vis, setVis] = useState<Visibility>(post.visibility);
  const [busy, setBusy] = useState(false);
  const [reacted, setReacted] = useState(post.reacted);
  const [count, setCount] = useState(post.reactions);
  const own = uid === post.author_id;
  const long = !full && post.body.length > 600;

  async function run(fn: () => Promise<void>, ok: string, after?: () => void) {
    setBusy(true);
    try { await fn(); toast.success(ok); after?.(); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }

  async function react() {
    if (post.guest) { toast.info("Zaloguj się lub dołącz do TNB, aby reagować na wpisy."); return; }
    const next = !reacted;
    setReacted(next); setCount((c) => c + (next ? 1 : -1));
    try { await toggleReaction(post.id, next); onChanged(); }
    catch (e) { setReacted(!next); setCount((c) => c + (next ? -1 : 1)); toast.error(e instanceof Error ? e.message : "Wystąpił błąd."); }
  }

  return (
    <article className="border border-border/60 bg-card/50 p-5 sm:p-7">
      <header className="flex items-center gap-3">
        <Initial name={post.author_name} />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{post.author_name}</p>
          <p className="text-xs text-muted-foreground">
            {fmtWhen(post.created_at)}{post.updated_at !== post.created_at && " · edytowano"}
            {!post.guest && <span className="ml-2">· {VIS_LABEL[post.visibility]}</span>}
            {post.status === "hidden" && <span className="ml-2 text-destructive">· ukryty przez moderatora</span>}
          </p>
        </div>
      </header>

      {editing ? (
        <div className="mt-4 space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={POST_MAX} aria-label="Treść posta" />
          <VisibilitySelect value={vis} onChange={setVis} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => updatePost(post.id, text, vis), "Zapisano zmiany.", () => setEditing(false))}>{busy ? "Zapisywanie…" : "Zapisz"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(post.body); setVis(post.visibility); }}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-wrap break-words text-[0.95rem] leading-[1.75] text-foreground/90">
          {long ? `${post.body.slice(0, 600)}…` : post.body}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
        <Button variant="ghost" size="sm" onClick={react} disabled={post.status !== "published"} aria-pressed={reacted}
          className={reacted ? "text-gold" : "text-muted-foreground"}>
          <Heart className={`mr-1.5 h-4 w-4 ${reacted ? "fill-current" : ""}`} /> Szacunek{post.guest ? "" : ` · ${count}`}
        </Button>
        {post.guest ? (full ? null : (
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/spolecznosc/$postId" params={{ postId: post.id }}><MessageSquare className="mr-1.5 h-4 w-4" /> Komentarze</Link>
          </Button>
        )) : full ? (
          <span className="flex items-center px-3 text-sm text-muted-foreground"><MessageSquare className="mr-1.5 h-4 w-4" /> {post.comments}</span>
        ) : (
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/spolecznosc/$postId" params={{ postId: post.id }}><MessageSquare className="mr-1.5 h-4 w-4" /> Komentarze · {post.comments}</Link>
          </Button>
        )}
        {long && <Link to="/spolecznosc/$postId" params={{ postId: post.id }} className="text-sm text-gold hover:underline">Czytaj dalej</Link>}
        {own && !editing && (
          <span className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edytuj</Button>
            <ConfirmDelete label="post" onConfirm={() => run(() => deletePost(post.id), "Post został usunięty.", onDeleted)} />
          </span>
        )}
      </footer>
    </article>
  );
}
