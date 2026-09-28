import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listMessages, setMessageStatus } from "@/lib/admin.functions";
import { fmtDate, MSG_STATUS , errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/wiadomosci")({ component: Inbox });

type Status = "inbox" | "new" | "read" | "archived" | "all";
type Row = Awaited<ReturnType<typeof listMessages>>[number];

function Inbox() {
  const list = useServerFn(listMessages);
  const setStatus = useServerFn(setMessageStatus);
  const qc = useQueryClient();
  const [status, setFilter] = useState<Status>("inbox");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Row | null>(null);
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ["admin-messages", status, search, sort], queryFn: () => list({ data: { status, q: search, sort } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "new" | "read" | "archived" }) => setStatus({ data: v }),
    onMutate: (v) => setSnap((p) => (p && p.id === v.id ? { ...p, status: v.status } : p)),
    onSuccess: (_r, v) => { toast.success(`Oznaczono: ${MSG_STATUS[v.status]}`); qc.invalidateQueries({ queryKey: ["admin-messages"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  // Keep the opened message visible even when a status change moves it out of the current filter.
  const open = data?.find((r) => r.id === openId) ?? (snap?.id === openId ? snap : null);

  function openMsg(r: Row) {
    setOpenId(r.id); setSnap(r);
    if (r.status === "new") m.mutate({ id: r.id, status: "read" });
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Wiadomości z formularza Kontakt</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => setFilter(v as Status)}>
          <SelectTrigger className="w-52" aria-label="Filtr statusu"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inbox">Skrzynka (bez archiwum)</SelectItem>
            <SelectItem value="new">Nowe</SelectItem>
            <SelectItem value="read">Przeczytane</SelectItem>
            <SelectItem value="archived">Archiwum</SelectItem>
            <SelectItem value="all">Wszystkie</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "desc" | "asc")}>
          <SelectTrigger className="w-44" aria-label="Sortowanie"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Najnowsze najpierw</SelectItem>
            <SelectItem value="asc">Najstarsze najpierw</SelectItem>
          </SelectContent>
        </Select>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
          <Input placeholder="Szukaj: imię, e-mail, temat" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
          <Button type="submit" variant="outline">Szukaj</Button>
        </form>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{errMsg(error)}</p>}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="divide-y divide-border/60 border border-border/60">
          {!isLoading && isFetching && <li className="p-2 text-xs text-muted-foreground">Odświeżanie…</li>}
          {isLoading && <li className="p-4 text-sm text-muted-foreground">Ładowanie…</li>}
          {data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">Brak wiadomości.</li>}
          {data?.map((r) => (
            <li key={r.id}>
              <button onClick={() => openMsg(r)} className={`w-full p-4 text-left hover:bg-foreground/5 ${openId === r.id ? "bg-foreground/10" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`truncate ${r.status === "new" ? "font-semibold" : ""}`}>{r.subject}</span>
                  <Badge variant={r.status === "new" ? "default" : "outline"}>{MSG_STATUS[r.status] ?? r.status}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{r.name} · {r.email} · {fmtDate(r.created_at)}</p>
              </button>
            </li>
          ))}
        </ul>
        {open ? (
          <article className="border border-border/60 p-5">
            <h2 className="font-display text-2xl">{open.subject}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Od: {open.name} &lt;<a className="underline" href={`mailto:${open.email}`}>{open.email}</a>&gt;</p>
            <p className="text-sm text-muted-foreground">Otrzymano: {fmtDate(open.created_at)} · Status: {MSG_STATUS[open.status]}</p>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed">{open.message}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {open.status !== "new" && <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: open.id, status: "new" })}>Oznacz jako nieprzeczytaną</Button>}
              {open.status === "new" && <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: open.id, status: "read" })}>Oznacz jako przeczytaną</Button>}
              {open.status !== "archived"
                ? <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: open.id, status: "archived" })}>Archiwizuj</Button>
                : <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: open.id, status: "read" })}>Przywróć do skrzynki</Button>}
            </div>
          </article>
        ) : <p className="text-sm text-muted-foreground">Wybierz wiadomość, aby zobaczyć treść.</p>}
      </div>
    </div>
  );
}
