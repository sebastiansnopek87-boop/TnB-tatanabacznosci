import { AlertTriangle } from "lucide-react";
import { getLegalPage, type LegalPage } from "@/config/site-settings";
import { PageHeading, PageShell } from "./PageShell";

export function legalHead(slug: LegalPage["slug"]) {
  const p = getLegalPage(slug);
  const title = `${p.title} — Tata Na Baczności`;
  return {
    meta: [
      { title },
      { name: "description", content: p.description },
      { property: "og:title", content: title },
      { property: "og:description", content: p.description },
      ...(p.approved ? [] : [{ name: "robots", content: "noindex" }]),
    ],
  };
}

export function LegalPageView({ slug }: { slug: LegalPage["slug"] }) {
  const p = getLegalPage(slug);
  const ready = p.approved && p.paragraphs.length > 0;
  return (
    <PageShell>
      <PageHeading eyebrow="Informacje" title={p.title} />
      <div className="px-5 py-14 lg:px-14 lg:py-20">
        {ready ? (
          <div className="max-w-3xl space-y-5 text-[0.95rem] leading-[1.8] text-foreground/85">
            {p.paragraphs.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        ) : (
          <div className="flex max-w-3xl gap-4 border border-gold/50 bg-surface p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" strokeWidth={1.5} />
            <div>
              <p className="text-[0.8rem] uppercase tracking-[0.14em] text-gold">Treść wymaga uzupełnienia</p>
              <p className="mt-2 text-[0.9rem] leading-[1.7] text-muted-foreground">
                Ten dokument nie został jeszcze dodany ani zatwierdzony. Przed publikacją serwisu treść musi zostać
                uzupełniona i zweryfikowana.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
