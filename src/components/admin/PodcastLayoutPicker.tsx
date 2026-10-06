import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPodcastLayout, setPodcastLayout, type PodcastLayout } from "@/lib/platform.functions";
import { errMsg } from "@/components/admin/format";

const OPTIONS: { value: PodcastLayout; title: string; desc: string }[] = [
  { value: "list", title: "Lista", desc: "Poziome paski z małą okładką z boku. Widać wiele odcinków naraz." },
  { value: "grid", title: "Siatka", desc: "Małe kafelki w kilku kolumnach z poziomą okładką." },
];

export function PodcastLayoutPicker() {
  const qc = useQueryClient();
  const setFn = useServerFn(setPodcastLayout);
  const cur = useQuery({ queryKey: ["podcast-layout"], queryFn: () => getPodcastLayout() });
  const save = useMutation({
    mutationFn: (layout: PodcastLayout) => setFn({ data: { layout } }),
    onSuccess: () => { toast.success("Zapisano układ odcinków"); qc.invalidateQueries({ queryKey: ["podcast-layout"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <section className="mt-6 border border-border/60 p-4">
      <h2 className="font-display text-lg font-semibold uppercase">Układ odcinków na stronie Głosu TNB</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const active = cur.data === o.value;
          return (
            <button key={o.value} type="button" disabled={save.isPending || cur.isLoading} aria-pressed={active}
              onClick={() => !active && save.mutate(o.value)}
              className={`border p-4 text-left ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/60"}`}>
              <p className="font-medium text-foreground">{o.title}{active && <span className="ml-2 text-xs uppercase tracking-[0.12em] text-gold">wybrany</span>}</p>
              <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
