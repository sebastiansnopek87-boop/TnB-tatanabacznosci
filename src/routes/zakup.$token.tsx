import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell } from "@/components/tnb/PageShell";
import { getPurchasedMaterial } from "@/lib/orders.functions";
import { fmtDay, fmtPrice } from "@/lib/library";
import { BANK_TRANSFER, bankConfigured } from "@/config/payments";

export const Route = createFileRoute("/zakup/$token")({
  head: () => ({ meta: [
    { title: "Twój materiał — Tata Na Baczności" }, { name: "description", content: "Zakupiony materiał premium TNB." },
    { property: "og:title", content: "Twój materiał — TNB" }, { property: "og:description", content: "Zakupiony materiał premium TNB." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Purchased,
});

function Purchased() {
  const { token } = Route.useParams();
  const ok = /^[0-9a-f-]{36}$/.test(token);
  const q = useQuery({ queryKey: ["purchased", token], enabled: ok, queryFn: () => getPurchasedMaterial({ data: { token, file: false } }) });
  const [busy, setBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  async function openFile() {
    setBusy(true); setFileErr(null);
    const r = await getPurchasedMaterial({ data: { token, file: true } }).catch(() => ({ error: "Nie udało się otworzyć pliku." }));
    setBusy(false);
    if ("url" in r && r.url) window.open(r.url, "_blank", "noopener"); else setFileErr("error" in r ? r.error : "Błąd");
  }
  const d = q.data;
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/biblioteka" className="text-[0.72rem] uppercase tracking-[0.14em] text-gold">← Biblioteka</Link>
        {!ok || (d && "error" in d) ? (
          <div className="mt-8 border border-border/60 p-8"><h1 className="font-display text-3xl font-semibold">Brak dostępu</h1><p className="mt-3 text-sm text-foreground/75">{d && "error" in d ? d.error : "Link jest nieprawidłowy."}</p></div>
        ) : d && "order" in d ? <OrderStatus o={d.order} /> : !d || !("item" in d) ? <p className="mt-8 text-sm text-muted-foreground">Ładowanie materiału…</p> : (
          <article className="mt-8">
            <p className="eyebrow text-gold">Twój zakupiony materiał</p>
            <h1 className="mt-3 break-words font-display text-[2.4rem] font-semibold leading-tight">{d.item?.title}</h1>
            {d.expiresAt && <p className="mt-2 text-xs text-muted-foreground">Link ważny do {fmtDay(d.expiresAt)}.</p>}
            {(d.body ?? "").trim() && <div className="mt-8 space-y-5 break-words leading-[1.85] text-foreground/90">{(d.body ?? "").split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
            {d.hasFile && <div className="mt-8 border border-border/60 bg-card p-5"><p className="text-sm">{d.fileName ?? "Plik materiału"}</p>
              <button onClick={openFile} disabled={busy} className="mt-3 bg-gold px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-60">{busy ? "Przygotowywanie…" : "Pobierz plik"}</button>
              {fileErr && <p className="mt-2 text-sm text-destructive">{fileErr}</p>}</div>}
            {d.externalUrl && <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block border border-gold/60 px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.14em] text-gold">Otwórz link</a>}
          </article>
        )}
      </div>
    </PageShell>
  );
}

const ST: Record<string, [string, string]> = {
  pending: ["Zamówienie przyjęte — oczekuje na płatność", "Wykonaj przelew według danych poniżej. Materiał wyślemy na Twój e-mail po zaksięgowaniu wpłaty. Zachowaj ten link — tu też otworzysz materiał po opłaceniu."],
  cancelled: ["Zamówienie anulowane", "To zamówienie zostało anulowane. Dostęp do materiału nie został przyznany."],
  refunded: ["Zwrot", "Środki za to zamówienie zostały zwrócone. Dostęp do materiału wygasł."],
  failed: ["Płatność nieudana", "Płatność nie została zrealizowana."],
};

function OrderStatus({ o }: { o: { status: string; number: string; amount: number; email: string; title: string; slug: string } }) {
  const [t, x] = ST[o.status] ?? ST["pending"]!;
  const v = (s: string) => s || <span className="italic text-muted-foreground">do uzupełnienia</span>;
  const row = (k: string, val: React.ReactNode) => <div className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2 text-sm"><span className="text-muted-foreground">{k}</span><span className="break-all text-right">{val}</span></div>;
  return (
    <div className="mt-8 border border-gold/50 bg-surface-deep p-6 sm:p-8">
      <p className="eyebrow text-gold">Zamówienie {o.number}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">{t}</h1>
      <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">{x}</p>
      <div className="mt-6">{row("Materiał", o.title)}{row("Kwota", fmtPrice(o.amount))}{row("E-mail", o.email)}</div>
      {o.status === "pending" && (
        <div className="mt-6">
          <p className="eyebrow text-gold">Dane do przelewu</p>
          {!bankConfigured() && <p className="mt-2 text-sm text-destructive">Dane rachunku nie zostały jeszcze uzupełnione. Nie wykonuj przelewu — skontaktuj się z nami przez formularz kontaktowy.</p>}
          <div className="mt-2">{row("Odbiorca", v(BANK_TRANSFER.recipient))}{row("Adres", v(BANK_TRANSFER.address))}{row("Numer rachunku", v(BANK_TRANSFER.accountNumber))}{row("Bank", v(BANK_TRANSFER.bankName))}{row("Kwota", fmtPrice(o.amount))}{row("Tytuł przelewu", o.number)}</div>
        </div>
      )}
      {o.slug && <Link to="/biblioteka/$slug" params={{ slug: o.slug }} className="mt-6 inline-block text-sm text-gold underline">Wróć do materiału</Link>}
    </div>
  );
}
