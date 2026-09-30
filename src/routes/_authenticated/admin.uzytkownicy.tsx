import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { listUsers, getUserDetail, setUserRole, ROLE_VALUES } from "@/lib/users.functions";
import { errMsg, fmtDate } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/uzytkownicy")({ component: UsersPage });

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrator", admin: "Administrator", moderator: "Moderator", editor: "Redaktor", support: "Obsługa użytkowników", premium: "Premium (podcast)",
};
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function UsersPage() {
  const fn = useServerFn(listUsers);
  const [q, setQ] = useState(""); const [applied, setApplied] = useState("");
  const [role, setRole] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, isFetching } = useQuery({
    queryKey: ["admin-users", applied, role, status, page],
    queryFn: () => fn({ data: { q: applied, role: role as never, status: status as never, page } }),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold uppercase">Użytkownicy</h1>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(q); }}>
        <Input className="max-w-xs" placeholder="E-mail, imię, nazwisko, nick" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj" />
        <select className={sel} value={role} onChange={(e) => { setPage(0); setRole(e.target.value); }} aria-label="Rola">
          <option value="">Wszystkie role</option><option value="none">Użytkownik (bez roli)</option>
          {ROLE_VALUES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className={sel} value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }} aria-label="Status">
          <option value="">Każdy status</option><option value="confirmed">E-mail potwierdzony</option><option value="unconfirmed">E-mail niepotwierdzony</option>
        </select>
        <Button type="submit" variant="outline">Szukaj</Button>
      </form>
      {error && <p className="text-sm text-destructive">{errMsg(error)}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
      {data && (data.rows.length === 0
        ? <p className="border border-border/60 p-4 text-sm text-muted-foreground">Brak kont spełniających kryteria.</p>
        : <div className="divide-y divide-border/60 border border-border/60">
            {data.rows.map((u) => (
              <button key={u.id} type="button" onClick={() => setOpen(u.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left text-sm hover:bg-foreground/5">
                <span className="min-w-0 flex-1 truncate font-medium">{u.email ?? "—"}{u.name && <span className="ml-2 text-muted-foreground">{u.name}</span>}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</span>
                <span className={u.confirmed ? "text-xs text-foreground/70" : "text-xs text-destructive"}>{u.confirmed ? "Potwierdzony" : "Niepotwierdzony"}</span>
                <span className="text-xs text-gold">{u.roles.length ? u.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") : "Użytkownik"}</span>
              </button>
            ))}
          </div>)}
      {data && (
        <div className="flex items-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0 || isFetching} onClick={() => setPage(page - 1)}>Poprzednia</Button>
          <span className="text-muted-foreground">Strona {page + 1} z {pages} · {data.total} kont</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages || isFetching} onClick={() => setPage(page + 1)}>Następna</Button>
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Szczegóły konta</DialogTitle></DialogHeader>
          {open && <UserDetail id={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserDetail({ id }: { id: string }) {
  const fn = useServerFn(getUserDetail); const setFn = useServerFn(setUserRole); const qc = useQueryClient();
  const { data: u, error } = useQuery({ queryKey: ["admin-user", id], queryFn: () => fn({ data: { id } }) });
  const [confirm, setConfirm] = useState<{ role: string; grant: boolean } | null>(null);
  const m = useMutation({
    mutationFn: (v: { role: string; grant: boolean }) => setFn({ data: { id, role: v.role as never, grant: v.grant } }),
    onSuccess: () => { toast.success("Zapisano zmianę roli."); qc.invalidateQueries({ queryKey: ["admin-user", id] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (error) return <p className="text-sm text-destructive">{errMsg(error)}</p>;
  if (!u) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  const rows: Array<[string, string]> = [
    ["E-mail", u.email ?? "—"], ["Imię i nazwisko", u.name ?? "—"], ["Nick", u.nick ?? "—"],
    ["Rejestracja", fmtDate(u.created_at)], ["Ostatnie logowanie", fmtDate(u.last_sign_in_at)],
    ["E-mail potwierdzony", u.confirmed ? "Tak" : "Nie"], ["Status konta", u.banned ? "Zablokowane" : "Aktywne"],
    ["Sposób logowania", u.providers.map((p) => (p === "email" ? "e-mail i hasło" : p === "google" ? "Google" : p === "apple" ? "Apple" : p)).join(", ") || "—"],
  ];
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></Fragment>)}
      </dl>
      <div>
        <h3 className="eyebrow text-gold">Role</h3>
        {!u.canManage && <p className="mt-2 text-xs text-muted-foreground">Role może zmieniać tylko superadministrator.</p>}
        <ul className="mt-2 space-y-2">
          {ROLE_VALUES.map((r) => {
            const on = u.roles.includes(r);
            return (
              <li key={r} className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2">
                <span className={on ? "text-gold" : "text-foreground/70"}>{ROLE_LABELS[r]}{on ? " ✓" : ""}</span>
                {u.canManage && <Button size="sm" variant={on ? "outline" : "default"} disabled={m.isPending} onClick={() => setConfirm({ role: r, grant: !on })}>{on ? "Odbierz" : "Nadaj"}</Button>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Moderator, Redaktor i Obsługa użytkowników są na razie tylko oznaczeniem — dostęp do panelu daje rola Administrator.</p>
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.grant ? "Nadać rolę?" : "Odebrać rolę?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && `${confirm.grant ? "Nadajesz" : "Odbierasz"} rolę „${ROLE_LABELS[confirm.role]}” kontu ${u.email ?? ""}.`}
              {u.isSelf && confirm && !confirm.grant ? " To Twoje własne konto." : ""} Zmiana zostanie zapisana w Dzienniku zdarzeń.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) m.mutate(confirm); setConfirm(null); }}>Potwierdź</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
