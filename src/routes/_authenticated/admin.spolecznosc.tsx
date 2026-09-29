import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listCommunity, moderateCommunity } from "@/lib/admin.functions";
import { fmtDate, errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/community/PostCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/spolecznosc")({ component: Moderation });

type F = "all" | "published" | "hidden";
type Action = "hide" | "restore" | "delete_post" | "delete_comment" | "set_visibility";

function Moderation() {
  const list = useServerFn(listCommunity);
  const mod = useServerFn(moderateCommunity);
  const qc = useQueryClient();
  const [status, setStatus] = useState<F>("all");
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-community", status], queryFn: () => list({ data: { status } }) });
  const m = useMutation({
    mutationFn: (v: { action: Action; id: string; visibility?: "public" | "community" }) => mod({ data: v as any }),
    onSuccess: (_r, v) => {
      toast.success({ hide: "Post ukryty.", restore: "Post przywrócony.", delete_post: "Post usunięty.", delete_comment: "Komentarz usunięty.", set_visibility: "Widoczność zmieniona." }[v.action]);
      qc.invalidateQueries({ queryKey: ["admin-community"] }); qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold uppercase">Moderacja społeczności</h1>
      <div className="mt-6">
        <Select value={status} onValueChange={(v) => setStatus(v as F)}>
          <SelectTrigger className="w-52" aria-label="Filtr statusu"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie posty</SelectItem>
            <SelectItem value="published">Opublikowane</SelectItem>
            <SelectItem value="hidden">Ukryte</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-muted-foreground">Wczytywanie…</p>}
        {error && <p className="text-destructive">{errMsg(error)}</p>}
        {data?.length === 0 && <p className="text-muted-foreground">Brak postów.</p>}
        {data?.map((p) => (
          <div key={p.id} className="border border-border/60 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{p.author_name}</span>
              <span className="text-muted-foreground">{fmtDate(p.created_at)}</span>
              <Badge variant={p.status === "hidden" ? "destructive" : "secondary"}>{p.status === "hidden" ? "Ukryty" : "Opublikowany"}</Badge>
              <Badge variant="outline">{p.visibility === "public" ? "Publiczny" : "Tylko dla społeczności"}</Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{p.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status === "published"
                ? <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ action: "hide", id: p.id })}>Ukryj</Button>
                : <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ action: "restore", id: p.id })}>Przywróć</Button>}
              <Button size="sm" variant="outline" disabled={m.isPending}
                onClick={() => m.mutate({ action: "set_visibility", id: p.id, visibility: p.visibility === "public" ? "community" : "public" })}>
                {p.visibility === "public" ? "Ustaw: tylko dla społeczności" : "Ustaw: publiczny"}
              </Button>
              <ConfirmDelete label="post wraz z komentarzami" onConfirm={() => m.mutate({ action: "delete_post", id: p.id })} />
            </div>
            {p.community_comments.length > 0 && (
              <div className="mt-3 space-y-2 border-l border-border pl-3">
                {p.community_comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-medium">{c.author_name}</span> <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                    <p className="whitespace-pre-wrap break-words">{c.body}</p>
                    <ConfirmDelete label="komentarz" onConfirm={() => m.mutate({ action: "delete_comment", id: c.id })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
