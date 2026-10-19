import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOME_ASSETS } from "@/lib/home-assets";
import { ITEM_ICONS, reorderItems, type PageSection } from "@/lib/pages";
const ICON_LABELS: Record<string, string> = { users: "Ludzie", book: "Książka", shield: "Tarcza", family: "Rodzina", target: "Rozwój", mic: "Mikrofon", calendar: "Kalendarz", compass: "Kompas", bag: "Torba", user: "Profil", none: "Bez ikony" };
const selectClass = "h-8 w-full border border-border bg-background px-2 text-xs";
type Patch = (p: Partial<PageSection>, key?: string) => void;
export function AppearanceFields({ s, onPatch }: { s: PageSection; onPatch: Patch }) {
  const ap = s.appearance ?? {};
  return <fieldset className="mb-4 space-y-2 border border-border p-2"><legend className="text-xs text-gold">Wygląd i proporcje</legend>
    {([ ["height", "Wysokość zdjęć / nagłówka", 48, 720, 410], ["padding", "Odstępy wewnętrzne", 0, 120, 32], ["gap", "Odstęp elementów", 0, 64, 0], ["width", "Szerokość tekstu", 280, 1600, 820], ["overlay", "Przyciemnienie", 0, 100, 65] ] as const).map(([key,label,min,max,fallback]) => <label key={key} className="block text-xs">{label}<Input aria-label={label} type="number" min={min} max={max} value={ap[key] ?? fallback} onChange={e => onPatch({ appearance: { ...ap, [key]: Math.min(max, Math.max(min, Number(e.target.value))) } })} /></label>)}
    <label className="block text-xs">Kolor akcentu<select aria-label="Kolor akcentu" className={selectClass} value={ap.tone ?? "copper"} onChange={e => onPatch({ appearance: { ...ap, tone: e.target.value as "copper" | "gold" | "text" } })}><option value="copper">Stara miedź</option><option value="gold">Złoto TNB</option><option value="text">Jasny tekst</option></select></label>
    <label className="block text-xs">Wyrównanie sekcji<select className={selectClass} value={ap.align ?? "center"} onChange={e => onPatch({ appearance: { ...ap, align: e.target.value as "left" | "center" | "right" } })}><option value="left">Do lewej</option><option value="center">Centralnie</option><option value="right">Do prawej</option></select></label>
  </fieldset>;
}
export function HomeItemFields({ s, index, busy, onPatch, onSelect, onUpload }: { s: PageSection; index: number; busy: boolean; onPatch: Patch; onSelect: (el: string) => void; onUpload: (file: File, item?: number) => void }) {
  const it = s.items[index]; if (!it) return null;
  const set = (p: Partial<typeof it>) => onPatch({ items: s.items.map((x,i) => i === index ? { ...x, ...p } : x) });
  const order = s.items.map((_,i) => i);
  const move = (to: number) => { if (to < 0 || to >= order.length) return; [order[index],order[to]] = [to,index]; onPatch(reorderItems(s,order)); onSelect(`item-${to}`); };
  return <div className="space-y-3">
    {!["home-footer", "home-talks", "home-hero"].includes(s.kind) && <label className="block text-xs">Adres docelowy<Input aria-label="Adres elementu" value={it.href ?? ""} maxLength={500} onChange={e => set({ href: e.target.value })} /></label>}
    {s.kind === "pillars" && <><label className="block text-xs">Rodzaj<select aria-label="Rodzaj karty" className={selectClass} value={it.variant ?? "card"} onChange={e => set({ variant: e.target.value as "card" | "tile" })}><option value="card">Duża karta</option><option value="tile">Kafelek</option></select></label>
      <label className="block text-xs">Etykieta przycisku karty<Input aria-label="Etykieta przycisku karty" value={it.cta ?? ""} maxLength={60} onChange={e => set({ cta: e.target.value })} /></label></>}
    <label className="block text-xs">Wyrównanie<select aria-label="Wyrównanie elementu" className={selectClass} value={it.align ?? "center"} onChange={e => set({ align: e.target.value as "left" | "center" | "right" })}><option value="left">Do lewej</option><option value="center">Centralnie</option><option value="right">Do prawej</option></select></label>
    {(s.kind === "cinematic" || s.kind === "pillars") && <fieldset className="space-y-2 border border-border p-2"><legend className="text-xs">Obraz sceny</legend>
      <select aria-label="Obraz sceny" className={selectClass} value={it.image ? "custom" : it.asset ?? ""} onChange={e => set({ image: null, asset: e.target.value || null })}><option value="">Brak obrazu</option>{it.image && <option value="custom">Własny obraz</option>}{Object.entries(HOME_ASSETS).map(([key,v]) => <option key={key} value={key}>{v.label}</option>)}</select>
      <label className="block cursor-pointer border border-border p-2 text-xs">Wgraj własne zdjęcie<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f,index); e.target.value = ""; }} /></label>
      <Input aria-label="Opis obrazu sceny" value={it.imageAlt ?? ""} maxLength={200} onChange={e => set({ imageAlt: e.target.value })} />
      {(["focalX","focalY"] as const).map(k => <label key={k} className="block text-xs">{k === "focalX" ? "Kadr poziomy" : "Kadr pionowy"}<input aria-label={k === "focalX" ? "Kadr poziomy" : "Kadr pionowy"} className="w-full" type="range" min={0} max={100} value={it[k] ?? 50} onChange={e => set({ [k]: Number(e.target.value) })} /></label>)}
    </fieldset>}
    {(s.kind === "value-strip" || s.kind === "quick-nav") && <select aria-label="Ikona" className={selectClass} value={it.icon ?? "users"} onChange={e => set({ icon: e.target.value as NonNullable<typeof it.icon> })}>{ITEM_ICONS.map((v) => <option key={v} value={v}>{ICON_LABELS[v]}</option>)}</select>}
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={it.hidden ?? false} onChange={e => set({ hidden: e.target.checked })} />Ukryj element</label>
    <div className="flex gap-2"><Button size="icon" variant="outline" title="Przesuń wcześniej" aria-label="Przesuń element wcześniej" disabled={index === 0} onClick={() => move(index - 1)}><ArrowUp /></Button><Button size="icon" variant="outline" title="Przesuń później" aria-label="Przesuń element później" disabled={index === order.length - 1} onClick={() => move(index + 1)}><ArrowDown /></Button><Button size="icon" variant="outline" title="Duplikuj element" aria-label="Duplikuj element" disabled={order.length >= 12} onClick={() => { order.splice(index+1,0,index); onPatch(reorderItems(s,order)); onSelect(`item-${index+1}`); }}><Copy /></Button><Button size="icon" variant="outline" title="Usuń element" aria-label="Usuń element" onClick={() => { onPatch(reorderItems(s,order.filter(i => i !== index))); onSelect("section"); }}><Trash2 /></Button></div>
  </div>;
}