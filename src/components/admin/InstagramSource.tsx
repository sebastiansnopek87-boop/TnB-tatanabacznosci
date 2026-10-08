import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDisconnectInstagram, adminGetInstagram, adminSaveInstagramOptions, adminStartInstagramConnect, adminSyncInstagram } from "@/lib/voice.functions";
import { errMsg } from "@/components/admin/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "—");
const RESULT: Record<string, string> = { polaczono: "Konto Instagram połączone.", anulowano: "Autoryzacja Instagrama została anulowana.", blad: "Nie udało się połączyć konta Instagram — szczegóły w dzienniku zdarzeń." };

export function InstagramSource() {
  const getFn = useServerFn(adminGetInstagram); const startFn = useServerFn(adminStartInstagramConnect);
  const syncFn = useServerFn(adminSyncInstagram); const discFn = useServerFn(adminDisconnectInstagram);
  const optFn = useServerFn(adminSaveInstagramOptions);
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
  const opts = s ? { show_reels: s.show_reels, show_posts: s.show_posts, show_carousels: s.show_carousels, display_count: s.display_count } : null;

  return (
    <section id="instagram" className="mt-12 border-t border-border/60 pt-8">
      <h2 className="font-display text-2xl font-semibold uppercase">Instagram — Głos TNB</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Połączenie przez oficjalną autoryzację Meta (Instagram API z logowaniem Instagram). Hasło do Instagrama nigdy tu nie trafia. Najnowsze materiały pobierają się same, gdy dane są starsze niż 30 minut, oraz przyciskiem „Synchronizuj teraz”. Nie da się ich dodawać ręcznie.</p>

      {s && !s.appConfigured && (
        <div className="mt-4 border border-destructive/60 p-4 text-sm">
          <p className="font-semibold text-destructive">Brak konfiguracji aplikacji Meta.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Konto Instagram musi być kontem profesjonalnym (Twórca lub Firma).</li>
            <li>W Meta for Developers utwórz aplikację typu „Business” i dodaj produkt „Instagram” → „API setup with Instagram login”.</li>
            <li>W „Business login settings” dodaj adres przekierowania (OAuth Redirect URI): <code className="break-all text-foreground">{origin}{s.callbackPath}</code> — oraz analogiczny adres dla opublikowanej strony.</li>
            <li>Skopiuj „Instagram app ID” i „Instagram app secret” i przekaż je jako sekrety <code>INSTAGRAM_APP_ID</code> i <code>INSTAGRAM_APP_SECRET</code>.</li>
            <li>Dopóki aplikacja jest w trybie deweloperskim, dodaj konto Instagram jako testera (Role aplikacji → Instagram Testers) i zaakceptuj zaproszenie w Instagramie.</li>
          </ol>
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
