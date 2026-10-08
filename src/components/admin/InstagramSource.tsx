import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminCheckInstagramConfig, adminDisconnectInstagram, adminGetInstagram, adminSaveInstagramOptions, adminStartInstagramConnect, adminSyncInstagram } from "@/lib/voice.functions";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "—");
const RESULT: Record<string, string> = { polaczono: "Konto Instagram połączone.", anulowano: "Autoryzacja Instagrama została anulowana.", blad: "Nie udało się połączyć konta Instagram — szczegóły w dzienniku zdarzeń." };

export function InstagramSource() {
  const getFn = useServerFn(adminGetInstagram); const startFn = useServerFn(adminStartInstagramConnect);
  const syncFn = useServerFn(adminSyncInstagram); const discFn = useServerFn(adminDisconnectInstagram);
  const optFn = useServerFn(adminSaveInstagramOptions); const checkFn = useServerFn(adminCheckInstagramConfig);
  const check = useMutation({ mutationFn: () => checkFn(), onSuccess: (r) => (r.ok ? toast.success("Konfiguracja kompletna.") : toast.error("Konfiguracja niepełna — zobacz listę poniżej.")), onError: (e) => toast.error(errMsg(e)) });
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("Skopiowano."), () => toast.error("Nie udało się skopiować."));
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-ig"], queryFn: () => getFn() });
  const refresh = () => ["admin-ig", "voice-instagram"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    const r = new URLSearchParams(window.location.search).get("instagram");
    if (r && RESULT[r]) (r === "polaczono" ? toast.success : toast.error)(RESULT[r]);
  }, []);

  const connect = useMutation({ mutationFn: () => startFn({ data: { origin: window.location.origin } }), onSuccess: (r) => { window.location.href = r.url; }, onError: (e) => toast.error(errMsg(e)) });
  const sync = useMutation({ mutationFn: () => syncFn(), onSuccess: (r) => { toast.success(`Synchronizacja: nowe ${r.added}, razem ${r.total}.`); refresh(); }, onError: (e) => { toast.error(errMsg(e)); refresh(); } });
  const disc = useMutation({ mutationFn: () => discFn(), onSuccess: () => { toast.success("Konto odłączone."); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  const opt = useMutation({ mutationFn: (v: { show_reels: boolean; show_posts: boolean; show_carousels: boolean; display_count: number }) => optFn({ data: v }), onSuccess: () => { toast.success("Zapisano. Zmiana obejmie kolejną synchronizację."); refresh(); }, onError: (e) => toast.error(errMsg(e)) });
  const s = q.data;
  const connected = !!s && s.status !== "disconnected" && !!s.username;
  const opts = s ? { show_reels: s.show_reels ?? true, show_posts: s.show_posts ?? false, show_carousels: s.show_carousels ?? false, display_count: s.display_count ?? 6 } : null;

  return (
    <section id="instagram" className="mt-12 border-t border-border/60 pt-8">
      <h2 className="font-display text-2xl font-semibold uppercase">Instagram — Głos TNB</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Połączenie przez oficjalną autoryzację Meta (Instagram API z logowaniem Instagram). Hasło do Instagrama nigdy tu nie trafia. Najnowsze materiały pobierają się same, gdy dane są starsze niż 30 minut, oraz przyciskiem „Synchronizuj teraz”. Nie da się ich dodawać ręcznie.</p>

      {s && (
        <div className="mt-4 space-y-4 border border-border/60 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status konfiguracji:</span>
            <Badge variant={connected ? "default" : s.status === "error" ? "destructive" : s.appConfigured ? "secondary" : "outline"}>
              {connected ? "Połączono" : s.status === "error" ? "Błąd" : s.appConfigured ? "Skonfigurowano" : "Nie skonfigurowano"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Instagram App ID i App Secret są zapisane w zaszyfrowanym magazynie sekretów serwera (nie w tej stronie i nie w kodzie). Wartości nigdy nie są tu pokazywane. Aby je wpisać lub zmienić, poproś asystenta o „bezpieczny formularz kluczy Instagram”.</p>
          {([["Redirect URI — PREVIEW / TEST", origin ? origin + s.callbackPath : ""], ["Redirect URI — PRODUKCJA", s.productionCallback ?? ""]] as const).map(([l, v]) => (
            <div key={l}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{l}</p>
              <div className="mt-1 flex gap-2">
                <input readOnly value={v || "Domena produkcyjna nie jest jeszcze ustawiona — adres pojawi się automatycznie po jej ustawieniu."} className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs" />
                <Button size="sm" variant="outline" disabled={!v} onClick={() => copy(v)}>Kopiuj</Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>{check.isPending ? "Sprawdzanie…" : "Sprawdź konfigurację"}</Button>
          </div>
          {check.data && (
            <ul className="space-y-1">
              {check.data.checks.map((c) => (
                <li key={c.key} className={c.ok && !c.hint ? "text-foreground" : c.optional ? "text-muted-foreground" : "text-destructive"}>
                  {c.ok && !c.hint ? "✓" : c.optional ? "○" : "✗"} {c.label}{c.optional && !c.ok ? " (opcjonalne do testów)" : ""}{c.hint ? ` — ${c.hint}` : ""}</li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-gold">Instrukcja konfiguracji Meta</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Konto Instagram musi być kontem profesjonalnym (Twórca lub Firma).</li>
              <li>W developers.facebook.com utwórz aplikację typu „Business”.</li>
              <li>Dodaj produkt „Instagram” → „API setup with Instagram login”.</li>
              <li>W „Business login settings” → „OAuth Redirect URIs” dodaj Redirect URI PREVIEW (powyżej).</li>
              <li>Dodaj tam też Redirect URI PRODUKCJA, gdy pojawi się powyżej.</li>
              <li>Skopiuj „Instagram app ID”.</li>
              <li>Skopiuj „Instagram app secret”.</li>
              <li>Wpisz je w bezpiecznym formularzu kluczy.</li>
              <li>Kliknij „Sprawdź konfigurację”.</li>
              <li>Kliknij „Połącz konto Instagram” (w trybie deweloperskim konto musi być dodane jako Instagram Tester i zaproszenie zaakceptowane).</li>
              <li>Zaloguj się i zaakceptuj autoryzację.</li>
              <li>Kliknij „Synchronizuj teraz” i sprawdź Reelsy na stronie Głos TNB.</li>
            </ol>
          </details>
        </div>
      )}

      {s && (
        <div className="mt-6 flex flex-col gap-4 border border-border/60 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={s.status === "ok" ? "default" : s.status === "error" ? "destructive" : "outline"}>{s.status === "ok" ? "● Połączono" : s.status === "error" ? "Błąd" : "Nie połączono"}</Badge>
              {connected && <Badge variant="outline">Materiały: {s.media_count}</Badge>}
            </div>
            <p>Profil: {connected ? <a href={s.profile_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-gold underline">@{s.username}</a> : "—"}</p>
            <p className="text-xs text-muted-foreground">Ostatnia synchronizacja: {dt(s.last_sync_at)}{s.last_sync_at && connected && ` (nowe ${s.last_sync_added})`}</p>
            {s.last_error && <p className="break-words text-xs text-destructive">{s.last_error}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? <>
              <Button onClick={() => sync.mutate()} disabled={sync.isPending}>{sync.isPending ? "Synchronizacja…" : "Synchronizuj teraz"}</Button>
              <Button variant="outline" disabled={disc.isPending} onClick={() => { if (confirm("Odłączyć konto Instagram? Pobrane materiały znikną ze strony.")) disc.mutate(); }}>Odłącz konto</Button>
            </> : <Button onClick={() => connect.mutate()} disabled={connect.isPending || !s.appConfigured}>{connect.isPending ? "Przekierowanie…" : "Połącz konto Instagram"}</Button>}
          </div>
        </div>
      )}

      {opts && (
        <div className="mt-4 border border-border/60 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Co pokazywać</p>
          <div className="mt-2 flex flex-wrap gap-5">
            {([["show_reels", "Reels"], ["show_posts", "Posty"], ["show_carousels", "Karuzele"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-gold" checked={opts[k]} disabled={opt.isPending} onChange={(e) => opt.mutate({ ...opts, [k]: e.target.checked })} />{l}</label>
            ))}
            <label className="flex items-center gap-2">Liczba wyświetlanych:
              <select className="border border-border bg-background px-2 py-1" value={opts.display_count} disabled={opt.isPending} onChange={(e) => opt.mutate({ ...opts, display_count: Number(e.target.value) })}>
                {[4, 6, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="text-muted-foreground">Sortowanie: najnowsze</span>
          </div>
        </div>
      )}
    </section>
  );
}
