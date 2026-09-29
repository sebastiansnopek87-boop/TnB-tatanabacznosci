import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, Heart, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POST_MAX, SECTORS, VIS_LABEL, deletePost, fmtWhen, reportPost, toggleReaction, updatePost, type Post, type Sector, type Visibility } from "@/lib/community";

export function SectorSelect({ value, onChange, id }: { value: Sector; onChange: (v: Sector) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Sector)}>
      <SelectTrigger id={id} className="w-full sm:w-48" aria-label="Sektor tematyczny"><SelectValue /></SelectTrigger>
      <SelectContent>{(Object.keys(SECTORS) as Sector[]).map((k) => <SelectItem key={k} value={k}>{SECTORS[k]}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ReportButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try { await reportPost(postId, reason); toast.success("Dziękujemy. Zgłoszenie trafiło do moderatora."); setOpen(false); setReason(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-muted-foreground"><Flag className="mr-1.5 h-4 w-4" /> Zgłoś</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Zgłoś wpis</DialogTitle><DialogDescription>Napisz, dlaczego ten wpis narusza zasady społeczności. Zgłoszenie zobaczy tylko moderator.</DialogDescription></DialogHeader>
        <Textarea rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Powód zgłoszenia" />
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button><Button disabled={busy} onClick={send}>{busy ? "Wysyłanie…" : "Wyślij zgłoszenie"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const [sector, setSector] = useState<Sector>(post.sector ?? "ogolne");
  const [busy, setBusy] = useState(false);
  const [reacted, setReacted] = useState(post.reacted);
  const [count, setCount] = useState(post.reactions);
  const own = uid === post.author_id;
  const long = false;

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
    <article className="rounded-sm border border-border/50 bg-card/70 p-5 shadow-[0_1px_0_0_color-mix(in_oklab,var(--color-gold)_12%,transparent)_inset] transition-colors hover:border-gold/30 sm:p-7">
      <header className="flex items-center gap-3">
        <Initial name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-medium text-foreground">{post.author_name}</p>
            <span className="border border-gold/40 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-gold">{SECTORS[post.sector] ?? SECTORS.ogolne}</span>
          </div>
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
          <div className="flex flex-col gap-2 sm:flex-row"><SectorSelect value={sector} onChange={setSector} /><VisibilitySelect value={vis} onChange={setVis} /></div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => updatePost(post.id, text, vis, sector), "Zapisano zmiany.", () => setEditing(false))}>{busy ? "Zapisywanie…" : "Zapisz"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(post.body); setVis(post.visibility); setSector(post.sector ?? "ogolne"); }}>Anuluj</Button>
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
          <Heart className={`mr-1.5 h-4 w-4 ${reacted ? "fill-current" : ""}`} /> Szacunek · {count}
        </Button>
        {full ? (
          <span className="flex items-center px-3 text-sm text-muted-foreground"><MessageSquare className="mr-1.5 h-4 w-4" /> Komentarze · {post.comments}</span>
        ) : (
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/spolecznosc/$postId" params={{ postId: post.id }}><MessageSquare className="mr-1.5 h-4 w-4" /> Komentarze · {post.comments}</Link>
          </Button>
        )}
        {!post.guest && !own && post.status === "published" && <ReportButton postId={post.id} />}
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
