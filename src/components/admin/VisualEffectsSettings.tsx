import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setVisualEffects, type VisualEffects } from "@/lib/platform.functions";
import { FX_DEFAULT, fxAttrs, normalizeFx } from "@/lib/visual-effects";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const INTENSITY = [["subtle", "Subtelna (zalecana)"], ["standard", "Standardowa"], ["off", "Wyłączona"]] as const;
const SPEED = [["fast", "Szybka"], ["standard", "Standardowa"], ["calm", "Spokojna"]] as const;

export function VisualEffectsSettings({ value, canEdit }: { value: Partial<VisualEffects> | undefined; canEdit: boolean }) {
  const [d, setD] = useState<VisualEffects>(normalizeFx(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const save = useServerFn(setVisualEffects);
  const qc = useQueryClient();
  useEffect(() => { setD(normalizeFx(value)); }, [value]);
  const set = <K extends keyof VisualEffects>(k: K, v: VisualEffects[K]) => setD((p) => ({ ...p, [k]: v }));
  const off = !d.enabled || d.intensity === "off";
  const dirty = JSON.stringify(d) !== JSON.stringify(normalizeFx(value));

  async function submit() {
    setBusy(true); setError(null);
    try {
      await save({ data: { effects: d } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-platform-settings"] }), qc.invalidateQueries({ queryKey: ["platform-settings-public"] })]);
      toast.success("Ustawienia efektów zapisane.");
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się zapisać."); }
    finally { setBusy(false); }
  }

  const toggles: [keyof VisualEffects, string, string][] = [
    ["reveal", "Pojawianie się sekcji podczas przewijania", "Sekcje poniżej ekranu wchodzą delikatnie podczas przewijania."],
    ["interactive", "Efekty przycisków i elementów interaktywnych", "Płynna zmiana kolorów i przybliżenie zdjęć kart po najechaniu."],
    ["panels", "Płynne przejścia menu i paneli", "Łagodne otwieranie menu głównego."],
  ];

  return <section aria-labelledby="fx-title" className="space-y-4 border-t border-border pt-6">
    <h2 id="fx-title" className="font-display text-xl font-semibold uppercase">Wydajność i efekty wizualne</h2>
    <p className="text-xs text-muted-foreground">Dotyczy strony publicznej. Użytkownicy z systemowym ustawieniem „ogranicz ruch” zawsze widzą stronę bez animacji.</p>
    <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
      <Label htmlFor="fx-enabled">Animacje</Label>
      <Switch id="fx-enabled" disabled={!canEdit || busy} checked={d.enabled} onCheckedChange={(v) => set("enabled", v)} />
    </div>
    {([["intensity", "Intensywność", INTENSITY], ["speed", "Szybkość", SPEED]] as const).map(([k, label, opts]) =>
      <fieldset key={k} className="space-y-2" disabled={!canEdit || busy}>
        <legend className="text-sm">{label}</legend>
        <div className="flex flex-wrap gap-2">{opts.map(([v, l]) =>
          <Button key={v} type="button" size="sm" variant={d[k] === v ? "default" : "outline"} aria-pressed={d[k] === v} onClick={() => set(k, v as never)}>{l}</Button>)}</div>
      </fieldset>)}
    {toggles.map(([k, label, hint]) => <div key={k} className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
      <div><Label htmlFor={`fx-${k}`}>{label}</Label><p className="text-xs text-muted-foreground">{hint}</p></div>
      <Switch id={`fx-${k}`} disabled={!canEdit || busy || off} checked={d[k] as boolean} onCheckedChange={(v) => set(k, v as never)} />
    </div>)}

    <div className="space-y-2">
      <div className="flex items-center justify-between"><span className="text-sm">Podgląd (przed zapisaniem)</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setReplay((n) => n + 1)}>Odtwórz podgląd</Button></div>
      <div key={replay} {...fxAttrs(d)} className="fx-preview border border-border/60 bg-surface p-4">
        <div className="fx-preview-card space-y-2" style={d.reveal && !off ? { animation: "fx-preview-in var(--fx-dur) var(--fx-ease) both" } : undefined}>
          <p className="font-display text-lg">Przykładowa sekcja</p>
          <p className="text-sm text-muted-foreground">Tak pojawi się sekcja podczas przewijania.</p>
          <button type="button" className="border border-gold/60 px-4 py-2 text-sm hover:bg-gold hover:text-background">Przykładowy przycisk</button>
        </div>
      </div>
      <style>{`@keyframes fx-preview-in{from{opacity:0;transform:translateY(var(--fx-shift))}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.fx-preview-card{animation:none!important}}`}</style>
    </div>

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {canEdit && <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || !dirty} onClick={submit}>{busy ? "Zapisywanie…" : "Zapisz efekty wizualne"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => setD(FX_DEFAULT)}>Przywróć ustawienia zalecane</Button>
    </div>}
  </section>;
}
