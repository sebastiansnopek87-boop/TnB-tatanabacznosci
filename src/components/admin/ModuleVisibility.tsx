import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MODULES, type ModuleVisibility } from "@/config/modules";
import { setModuleVisibility } from "@/lib/platform.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function ModuleVisibilitySettings({ value, canEdit }: { value?: ModuleVisibility; canEdit: boolean }) {
  const [draft, setDraft] = useState<ModuleVisibility>(value ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useServerFn(setModuleVisibility);
  const qc = useQueryClient();
  useEffect(() => { setDraft(value ?? {}); }, [value]);
  async function submit() {
    setBusy(true); setError(null);
    try {
      await save({ data: { visibility: draft } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-platform-settings"] }), qc.invalidateQueries({ queryKey: ["platform-settings-public"] })]);
      toast.success("Widoczność modułów zapisana.");
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się zapisać widoczności."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="module-visibility-title" className="space-y-4 border-t border-border pt-6">
    <h2 id="module-visibility-title" className="font-display text-xl font-semibold uppercase">Widoczność modułów</h2>
    <div className="grid grid-cols-[minmax(0,1fr)_60px_60px] gap-3 border-b border-border pb-2 text-xs text-muted-foreground"><span>Moduł</span><span>Menu</span><span>Strona</span></div>
    {MODULES.map(m => <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_60px_60px] items-center gap-3 border-b border-border/40 pb-3">
      <span className="text-sm">{m.label}</span>
      {(["menu", "page"] as const).map(surface => <Switch key={surface} aria-label={`${m.label} — ${surface === "menu" ? "Menu" : "Strona"}`} disabled={!canEdit || busy || (m.id === "newsletter" && surface === "menu")} checked={draft[m.id]?.[surface] !== false}
        onCheckedChange={checked => setDraft(prev => ({ ...prev, [m.id]: { menu: prev[m.id]?.menu !== false, page: prev[m.id]?.page !== false, [surface]: checked } }))} />)}
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {canEdit && <Button type="button" disabled={busy} onClick={submit}>{busy ? "Zapisywanie…" : "Zapisz widoczność modułów"}</Button>}
  </section>;
}