import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errMsg } from "@/components/admin/format";
import {
  getArticleNewsletter, prepareArticleNewsletter, saveArticleNewsletter, sendArticleNewsletter, sendArticleNewsletterTest, unmarkArticleNewsletter,
} from "@/lib/article-newsletter.functions";

export const NL_STATUS: Record<string, string> = {
  none: "NIE PRZEZNACZONY DO NEWSLETTERA", prepared: "PRZYGOTOWANY", pending_approval: "DO ZATWIERDZENIA", approved: "ZATWIERDZONY DO WYSYŁKI",
  sending: "WYSYŁANIE", sent: "WYSŁANY", failed: "BŁĄD WYSYŁKI",
};
type C = { subject: string; preheader: string; intro: string; teaser: string; outro: string };

// Article module: AI provenance (admin-only) + optional newsletter announcement.
export function ArticleNewsletter({ articleId, dirty }: { articleId: string; dirty: boolean }) {
  const get = useServerFn(getArticleNewsletter), prep = useServerFn(prepareArticleNewsletter), save = useServerFn(saveArticleNewsletter),
    test = useServerFn(sendArticleNewsletterTest), send = useServerFn(sendArticleNewsletter), unmark = useServerFn(unmarkArticleNewsletter);
  const q = useQuery({ queryKey: ["article-nl", articleId], queryFn: () => get({ data: { articleId } }) });
  const [c, setC] = useState<C | null>(null), [edited, setEdited] = useState(false), [busy, setBusy] = useState<string | null>(null), [confirm, setConfirm] = useState(false);
  const nl: any = q.data?.newsletter;
  useEffect(() => { if (nl) { setC({ subject: nl.subject, preheader: nl.preheader, intro: nl.intro, teaser: nl.teaser, outro: nl.outro }); setEdited(false); } }, [nl?.updated_at]);
  if (q.isLoading) return null;
  if (q.error) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>;
  const d = q.data!;
  const status = nl?.status ?? "none";
  const run = async (k: string, fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(k); try { const r = await fn(); toast.success(ok(r)); await q.refetch(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const modeLabel = d.mode === "live" ? "WYSYŁKA RZECZYWISTA" : "WYSYŁKA TESTOWA";
  const editable = ["prepared", "pending_approval", "approved", "failed"].includes(status);
  const o: any = d.origin;

  return (
    <>
      {o && <div className="space-y-1 border border-gold/40 p-4 text-sm">
        <h2 className="font-display text-lg font-semibold uppercase">Pochodzenie: Asystent AI</h2>
        <p className="text-muted-foreground">Przygotowano przy pomocy Asystenta AI · materiał {o.material_id?.slice(0, 8) ?? "—"} · wersja {o.version_n ?? "—"} · przekazano {new Date(o.handed_off_at).toLocaleString("pl-PL")}. Widoczne tylko w panelu.</p>
        {o.tags?.length > 0 && <p>Tagi: {o.tags.join(", ")}</p>}
        {o.cta && <p>Propozycja CTA: {o.cta}</p>}
        <p>Źródła AI: {(o.sources ?? []).length ? (o.sources as any[]).map((s) => s.title).join("; ") : "brak"}</p>
      </div>}

      <div className="space-y-3 border border-border/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase">Newsletter</h2>
          <span className="text-xs uppercase tracking-wide text-gold">{NL_STATUS[status]}{nl?.mode ? ` · ${nl.mode === "live" ? "WYSYŁKA RZECZYWISTA" : "WYSYŁKA TESTOWA"}` : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground">Publikacja artykułu i wysyłka newslettera to dwa osobne działania — nic nie wysyła się samo. Odbiorcy: wyłącznie aktywni subskrybenci z istniejącej listy. Tryb środowiska: <b>{modeLabel}</b>{d.mode === "test" ? " (wiadomości trafiają tylko do historii powiadomień, nikt ich nie otrzyma)" : ""}.</p>
        {d.mode === "test" && <p className="border border-destructive/60 bg-destructive/10 p-2 text-center text-xs font-semibold uppercase tracking-wide text-destructive">TRYB TESTOWY — WIADOMOŚĆ NIE ZOSTANIE WYSŁANA DO PRAWDZIWYCH ODBIORCÓW</p>}
        {nl?.last_note && <p className="border-l-2 border-gold pl-3 text-sm">{nl.last_note}</p>}

        {!d.published ? <p className="text-sm text-muted-foreground">Opcja „Dodaj do newslettera” będzie dostępna po opublikowaniu artykułu.</p>
          : status === "none" ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy || dirty} onClick={() => run("prep", () => prep({ data: { articleId, useAi: false } }), () => "Przygotowano newsletter z zajawki")}>DODAJ DO NEWSLETTERA</Button>
              <Button variant="outline" disabled={!!busy || dirty} onClick={() => run("prep", () => prep({ data: { articleId, useAi: true } }), () => "AI przygotowało newsletter")}>{busy === "prep" ? "Przygotowuję…" : "Przygotuj treść z AI (1 wywołanie)"}</Button>
            </div>
          ) : c && (
            <div className="space-y-3">
              <label className="block text-xs">TEMAT<Input value={c.subject} maxLength={150} disabled={!editable} onChange={(e) => { setC({ ...c, subject: e.target.value }); setEdited(true); }} /></label>
              <label className="block text-xs">PREHEADER<Input value={c.preheader} maxLength={200} disabled={!editable} onChange={(e) => { setC({ ...c, preheader: e.target.value }); setEdited(true); }} /></label>
              <label className="block text-xs">TREŚĆ — wprowadzenie<Textarea rows={2} value={c.intro} maxLength={600} disabled={!editable} onChange={(e) => { setC({ ...c, intro: e.target.value }); setEdited(true); }} /></label>
              <label className="block text-xs">TREŚĆ — zajawka artykułu<Textarea rows={4} value={c.teaser} maxLength={1500} disabled={!editable} onChange={(e) => { setC({ ...c, teaser: e.target.value }); setEdited(true); }} /></label>
              <label className="block text-xs">TREŚĆ — zakończenie<Textarea rows={2} value={c.outro} maxLength={600} disabled={!editable} onChange={(e) => { setC({ ...c, outro: e.target.value }); setEdited(true); }} /></label>
              <p className="text-xs">PRZYCISK: <b>„PRZECZYTAJ ARTYKUŁ”</b> → strona artykułu · stopka z osobistym linkiem do wypisania</p>
              <p className="text-sm">LICZBA ODBIORCÓW: <b className="text-gold">{d.activeSubscribers}</b> aktywnych subskrybentów</p>
              {editable && <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!edited || !!busy} onClick={() => run("save", () => save({ data: { articleId, ...c } }), () => "Zapisano treść newslettera")}>Zapisz zmiany</Button>
                <Button variant="outline" disabled={edited || !!busy} onClick={() => run("test", () => test({ data: { articleId } }), (r) => r.status === "sent" ? `Wysłano test na ${r.to}` : r.status === "simulated" ? `WYSYŁKA TESTOWA: zapisano w historii (adres ${r.to}), nic nie dostarczono` : `Test nieudany: ${r.reason ?? r.status}`)}>WYŚLIJ TESTOWO</Button>
                {!confirm ? <Button disabled={edited || !!busy || !d.activeSubscribers} onClick={() => setConfirm(true)}>ZATWIERDŹ I WYŚLIJ</Button> : (
                  <div className="w-full border border-gold/60 p-3 text-sm">
                    <p>Newsletter zostanie wysłany do <b>{d.activeSubscribers}</b> aktywnych subskrybentów. Tryb: <b>{modeLabel}</b>.</p>
                    <div className="mt-2 flex gap-2">
                      <Button disabled={!!busy} onClick={() => run("send", () => send({ data: { articleId, expectedRecipients: d.activeSubscribers, confirmed: true } }), (r) => r.note).then(() => setConfirm(false))}>{busy === "send" ? "Wysyłanie…" : "POTWIERDZAM WYSYŁKĘ"}</Button>
                      <Button variant="outline" disabled={!!busy} onClick={() => setConfirm(false)}>Anuluj</Button>
                    </div>
                  </div>)}
                <Button variant="ghost" disabled={!!busy} onClick={() => run("unmark", () => unmark({ data: { articleId } }), () => "Artykuł nie jest już przeznaczony do newslettera")}>Nie wysyłaj w newsletterze</Button>
              </div>}
              {edited && <p className="text-xs text-gold">Zapisz zmiany przed testem lub wysyłką.</p>}
            </div>
          )}
        {dirty && d.published && status === "none" && <p className="text-xs text-gold">Najpierw zapisz zmiany w artykule.</p>}
      </div>
    </>
  );
}
