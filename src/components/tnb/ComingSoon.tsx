import { Link } from "@tanstack/react-router";
import { PageHeading, PageShell } from "./PageShell";

export function ComingSoon({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <PageShell>
      <PageHeading eyebrow={eyebrow} title={title} intro={intro} />
      <div className="px-5 py-14 lg:px-14">
        <div className="max-w-2xl border border-gold/40 bg-surface-deep p-8">
          <p className="eyebrow text-gold">W przygotowaniu</p>
          <p className="mt-4 text-[0.95rem] leading-[1.75] text-foreground/80">
            Ta część serwisu jest właśnie przygotowywana. Wróć wkrótce — a tymczasem zajrzyj do społeczności.
          </p>
          <Link
            to="/spolecznosc"
            className="mt-6 inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright"
          >
            Przejdź do społeczności
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

export function comingSoonHead(title: string, desc: string) {
  const t = `${title} — Tata Na Baczności`;
  return {
    meta: [
      { title: t },
      { name: "description", content: desc },
      { property: "og:title", content: t },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
