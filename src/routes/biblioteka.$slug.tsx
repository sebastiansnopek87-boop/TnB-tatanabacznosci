import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageShell } from "@/components/tnb/PageShell";
import { useUid } from "@/lib/community";
import { KINDS, accessLabel, fmtPrice, coverSrc, fmtDay, getLibraryItem, listCategories } from "@/lib/library";
import { getLibraryFileUrl } from "@/lib/library.functions";
import { BuyPanel } from "@/components/library/BuyPanel";

export const Route = createFileRoute("/biblioteka/$slug")({
  head: () => ({
    meta: [
      { title: "Materiał — Biblioteka TNB" },
      { name: "description", content: "Materiał z Biblioteki Tata Na Baczności." },
      { property: "og:title", content: "Materiał — Biblioteka TNB" },
      { property: "og:description", content: "Materiał z Biblioteki Tata Na Baczności." },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { slug } = Route.useParams();
  const { uid, ready } = useUid();
  const q = useQuery({ queryKey: ["library-item", slug, uid], queryFn: () => getLibraryItem(slug), enabled: ready });
  const cats = useQuery({ queryKey: ["library-cats"], queryFn: listCategories });
  const fileFn = useServerFn(getLibraryFileUrl);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openFile() {
    setFileErr(null); setBusy(true);
    try { const r = await fileFn({ data: { slug } }); window.open(r.url, "_blank", "noopener"); }
    catch (e) { setFileErr(e instanceof Error ? e.message : "Nie udało się otworzyć pliku."); }
    finally { setBusy(false); }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-5 py-12 lg:py-16">
        <Link to="/biblioteka" className="text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:text-gold-bright">← Wróć do biblioteki</Link>
        {!ready || q.isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Ładowanie materiału…</p>
        ) : q.error ? (
          <p className="mt-10 text-sm text-foreground/80">Nie udało się wczytać materiału. <button className="text-gold underline" onClick={() => q.refetch()}>Spróbuj ponownie</button></p>
        ) : !q.data ? (
          <div className="mt-10 border border-border/60 p-8">
            <h1 className="font-display text-3xl font-semibold uppercase">Nie znaleziono materiału</h1>
            <p className="mt-3 text-sm text-foreground/70">Ten materiał nie istnieje albo nie jest już dostępny.</p>
          </div>
        ) : (() => {
          const { item: it, content } = q.data;
          const img = coverSrc(it);
          return (
            <article className="mt-8">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] uppercase tracking-[0.12em]">
                <span className="text-gold">{cats.data?.find((c) => c.slug === it.category)?.name ?? it.category}</span>
                <span className="text-muted-foreground">{KINDS[it.kind]}</span>
                <span className={it.access === "premium" ? "text-gold" : "text-muted-foreground"}>{accessLabel(it)}</span>
              </div>
              <h1 className="mt-4 break-words font-display text-[2.2rem] font-semibold leading-tight text-foreground sm:text-[2.8rem]">{it.title}</h1>
              <p className="mt-3 text-sm text-muted-foreground">{it.author_name} · {fmtDay(it.published_at)} · Format: {KINDS[it.kind]}</p>
              {img && <img src={img} alt="" className="mt-8 aspect-[16/9] w-full border border-border/60 object-cover" />}
              {it.summary && <p className="mt-8 break-words text-[1.05rem] leading-[1.8] text-foreground/85">{it.summary}</p>}

              {!content ? (
                <div className="mt-10 border border-gold/50 bg-surface-deep p-6 sm:p-8">
                  {it.access === "premium" ? (<>
                    <p className="eyebrow text-gold">Materiał premium</p>
                    <p className="mt-3 font-display text-3xl font-semibold text-foreground">{fmtPrice(it.price_amount) ?? "Cena wkrótce"}</p>
                    <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">Pełna zawartość jest dostępna po zakupie. Konto nie jest wymagane — materiał otrzymasz na podany adres e-mail.</p>
                    {it.purchasable && it.price_amount && it.price_amount >= 100 ? (
                      <BuyPanel slug={it.slug} title={it.title} price={it.price_amount} />
                    ) : (<>
                      <button type="button" disabled className="mt-6 cursor-not-allowed bg-gold/40 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground">Kup materiał</button>
                      <p className="mt-2 text-xs text-muted-foreground">Sprzedaż tego materiału jeszcze nie ruszyła.</p>
                    </>)}
                  </>) : (<>
                    <p className="eyebrow text-gold">Dla członków TNB</p>
                    <p className="mt-3 text-[0.95rem] leading-[1.75] text-foreground/85">Ten materiał jest dostępny dla członków społeczności TNB. Zaloguj się lub dołącz do nas, aby uzyskać dostęp.</p>
                    {!uid && (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link to="/auth" search={{ powrot: `/biblioteka/${it.slug}` }} className="bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Zaloguj się</Link>
                        <Link to="/auth" search={{ tryb: "rejestracja", powrot: `/biblioteka/${it.slug}` }} className="border border-gold/60 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10">Dołącz do TNB</Link>
                      </div>
                    )}
                  </>)}
                </div>
              ) : (
                <div className="mt-10 space-y-6">
                  {content.body.trim() && (
                    <div className="space-y-5 break-words text-[1rem] leading-[1.85] text-foreground/90">
                      {content.body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
                    </div>
                  )}
                  {content.file_path && (
                    <div className="border border-border/60 bg-card p-5">
                      <p className="text-sm text-foreground/80">{content.file_name ?? "Plik materiału"}</p>
                      <button onClick={openFile} disabled={busy} className="mt-3 bg-gold px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright disabled:opacity-60">
                        {busy ? "Przygotowywanie…" : it.kind === "pdf" ? "Pobierz PDF" : "Otwórz plik"}
                      </button>
                      {fileErr && <p className="mt-2 text-sm text-destructive">{fileErr}</p>}
                    </div>
                  )}
                  {content.external_url && (
                    <a href={content.external_url} target="_blank" rel="noopener noreferrer" className="inline-block border border-gold/60 px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.14em] text-gold hover:bg-gold/10">
                      Otwórz link zewnętrzny
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })()}
      </div>
    </PageShell>
  );
}
