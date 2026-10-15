import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, X } from "lucide-react";
import { getBrandSettings, saveBrandSettings, createBrandUpload, finalizeBrandUpload } from "@/lib/brand.functions";
import { errMsg } from "./format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/logo.png.asset.json";

// Branding = public data only: logo, favicon, og_image, header_image, header_size,
// site_name, slogan, show_slogan, public_title, public_description, site_url. Secrets stay in the secure store.
type Form = {
  logo: string; favicon: string; og_image: string; header_image: string;
  header_size: string; site_name: string; public_title: string; public_description: string; site_url: string;
  slogan: string; show_slogan: boolean;
};
const FORM_KEYS = ["logo", "favicon", "og_image", "header_image", "header_size", "site_name", "public_title", "public_description", "site_url"] as const;

function putFile(bucket: string, path: string, token: string, file: File) {
  const url = `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/upload/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("content-type", file.type);
    x.setRequestHeader("x-upsert", "false");
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(x.status === 413 ? "Plik jest za duży." : "Nie udało się przesłać pliku.")));
    x.onerror = () => reject(new Error("Brak połączenia z serwerem. Spróbuj ponownie."));
    x.send(file);
  });
}

function ImageField({ label, hint, accept, value, preview, busy, canEdit, onPick, onClear }:
  { label: string; hint?: string; accept: string; value: string; preview: string | null; busy: boolean; canEdit: boolean; onPick: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const src = preview ?? (value ? `/api/public/brand/${value.replace(/^brand\//, "")}` : null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center border border-border/60 bg-foreground/5 p-2">
          {src ? <img src={src} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Brak</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button type="button" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Przesyłanie…" : "Wybierz plik"}</Button>}
          {canEdit && value && <Button type="button" variant="outline" disabled={busy} onClick={onClear} aria-label={`Usuń ${label}`}><X className="h-4 w-4" />Usuń</Button>}
          <input ref={ref} type="file" accept={accept} className="hidden" aria-label={`Plik: ${label}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); if (ref.current) ref.current.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

export function BrandSettings({ canEdit }: { canEdit: boolean }) {
  const get = useServerFn(getBrandSettings);
  const save = useServerFn(saveBrandSettings);
  const start = useServerFn(createBrandUpload);
  const fin = useServerFn(finalizeBrandUpload);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-brand-settings"], queryFn: () => get() });
  const [f, setF] = useState<Form | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  if (error) return <p className="text-sm text-destructive">{errMsg(error)}</p>;
  if (data && !f) {
    const s = { slogan: typeof data.settings.slogan === "string" ? data.settings.slogan : "Ojcostwo to służba", show_slogan: data.settings.show_slogan !== false } as Form;
    for (const k of FORM_KEYS) {
      const value = data.settings[k];
      s[k] = typeof value === "string" ? value : "";
    }
    setF(s);
  }
  if (!data || !f) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  async function upload(key: string, file: File) {
    setBusy(true);
    try {
      const t = await start({ data: { name: file.name, type: file.type, size: file.size } });
      await putFile(t.bucket, t.path, t.token, file);
      await fin({ data: { path: t.path } });
      setF((p) => p ? { ...p, [key]: t.path } : p);
      setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
      toast.success("Plik gotowy. Zapisz zmiany, aby zastosować.");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: f });
      setPreviews((p) => { for (const u of Object.values(p)) URL.revokeObjectURL(u); return {}; });
      toast.success("Ustawienia marki zapisane.");
      qc.invalidateQueries({ queryKey: ["admin-brand-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-settings-public"] });
    } catch (e) {
      let text = errMsg(e);
      try { const p = JSON.parse((e as Error).message); if (Array.isArray(p)) text = p.map((i: { message: string }) => i.message).join(" · "); } catch { /* plain */ }
      toast.error(text);
    } finally { setSaving(false); }
  }

  const ro = !canEdit || busy || saving;

  return (
    <section className="space-y-6 border border-border/60 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase">Wygląd i tożsamość strony</h2>
        <p className="mt-1 text-xs text-muted-foreground">Logo, ikona przeglądarki, obraz udostępowania i dane widoczne publicznie. Zmieniać może tylko superadministrator. To wyłącznie dane publiczne — nie wpisuj tu haseł ani kluczy.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ImageField label="Logo strony" hint="Pokazywane w nagłówku, stopce i na ekranie logowania. PNG, JPG, WEBP, maks. 2 MB."
          accept=".png,.jpg,.jpeg,.webp" value={f.logo} preview={previews["logo"] ?? null} busy={busy} canEdit={canEdit}
          onPick={(file) => void upload("logo", file)} onClear={() => set("logo", "")} />
        <ImageField label="Ikona przeglądarki (favicon)" hint="Mały znak na karcie przeglądarki. Najlepiej kwadrat 64×64 lub 512×512. PNG albo ICO."
          accept=".png,.ico" value={f.favicon} preview={previews["favicon"] ?? null} busy={busy} canEdit={canEdit}
          onPick={(file) => void upload("favicon", file)} onClear={() => set("favicon", "")} />
        <ImageField label="Obraz udostępowania" hint="Pokazywany przy udostępnianiu linku w mediach społecznościowych. Zalecane proporcje 1200×630. PNG, JPG, WEBP."
          accept=".png,.jpg,.jpeg,.webp" value={f.og_image} preview={previews["og_image"] ?? null} busy={busy} canEdit={canEdit}
          onPick={(file) => void upload("og_image", file)} onClear={() => set("og_image", "")} />
        <ImageField label="Obraz w nagłówku" hint="Opcjonalny znak w nagłówku zamiast logo. Rozmiar wybierasz poniżej."
          accept=".png,.jpg,.jpeg,.webp" value={f.header_image} preview={previews["header_image"] ?? null} busy={busy} canEdit={canEdit}
          onPick={(file) => void upload("header_image", file)} onClear={() => set("header_image", "")} />
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="hdr-size">Rozmiar obrazu w nagłówku</Label>
        <select id="hdr-size" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" disabled={ro}
          value={f.header_size} onChange={(e) => set("header_size", e.target.value)}>
          <option value="">Domyślny</option>
          <option value="small">Mały</option>
          <option value="medium">Średni</option>
          <option value="large">Duży</option>
          <option value="very_large">Bardzo duży</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="bs-slogan">Slogan marki</Label>
          <Input id="bs-slogan" disabled={ro} value={f.slogan} maxLength={200} onChange={(e) => set("slogan", e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="bs-show-slogan">Pokaż slogan</Label>
          <Switch id="bs-show-slogan" disabled={ro} checked={f.show_slogan} onCheckedChange={(v) => set("show_slogan", v)} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gold">SEO strony głównej</h3>
        <p className="text-xs text-muted-foreground">Tytuł i opis widoczne w wynikach wyszukiwania oraz przy udostępnianiu strony głównej. Podstrony zachowują własne tytuły i opisy.</p>
        <div className="space-y-2"><Label htmlFor="bs-name">Nazwa witryny (napis obok logo w lewym górnym rogu)</Label>
          <Input id="bs-name" disabled={ro} value={f.site_name} maxLength={200} onChange={(e) => set("site_name", e.target.value)} placeholder="Tata Na Baczności" />
          <div className="flex items-center gap-3 border border-border/60 bg-surface-deep p-3">
            <img src={previews["header_image"] ?? previews["logo"] ?? (f.header_image || f.logo ? `/api/public/brand/${(f.header_image || f.logo).replace(/^brand\//, "")}` : logo.url)} alt="" className="h-12 w-12 object-contain" />
            <span className="text-copper font-display text-xl font-bold uppercase tracking-[0.12em]">{f.site_name || "Tata Na Baczności"}</span>
          </div></div>
        <div className="space-y-2"><Label htmlFor="bs-title">Publiczny tytuł strony głównej</Label>
          <Input id="bs-title" disabled={ro} value={f.public_title} maxLength={200} onChange={(e) => set("public_title", e.target.value)} placeholder="np. Tata Na Baczności — Ojcostwo to służba" /></div>
        <div className="space-y-2"><Label htmlFor="bs-desc">Publiczny opis strony głównej</Label>
          <Textarea id="bs-desc" disabled={ro} rows={3} maxLength={2000} value={f.public_description} onChange={(e) => set("public_description", e.target.value)} placeholder="Krótki opis widoczny w wyszukiwarkach…" /></div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bs-url">Publiczny adres witryny</Label>
        <div className="flex max-w-xl gap-2">
          <Input id="bs-url" disabled={ro} value={f.site_url} maxLength={500} onChange={(e) => set("site_url", e.target.value)} placeholder="https://…" />
          <Button type="button" variant="outline" disabled={!f.site_url} onClick={() => { void navigator.clipboard.writeText(f.site_url); toast.success("Adres skopiowany."); }} aria-label="Skopiuj publiczny adres">
            <Copy className="h-4 w-4" />Kopiuj
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Adres używany przy udostępnianiu linków. Publikacja i własna domena to osobne decyzje.</p>
      </div>

      {canEdit && <Button type="button" disabled={saving} onClick={() => void onSave()}>{saving ? "Zapisywanie…" : "Zapisz ustawienia marki"}</Button>}
      {canEdit && <p className="text-xs text-muted-foreground">Zmiany zatwierdzasz jednym przyciskiem; zastąpione pliki są usuwane.</p>}
      {!canEdit && <p className="border border-gold/50 p-3 text-sm">Tryb podglądu. Zmieniać ustawienia marki może tylko superadministrator.</p>}
    </section>
  );
}
