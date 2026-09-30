import { Link } from "@tanstack/react-router";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { pageImageUrl, type PublicPage } from "@/lib/pages";
import { PageView } from "./PageView";

const SITE = "Tata Na Baczności";

export function cmsHead(page: PublicPage | null | undefined, fallbackTitle: string, fallbackDesc: string, path: string) {
  if (!page) return { meta: [{ title: `${fallbackTitle} — ${SITE}` }, { name: "description", content: fallbackDesc }, { name: "robots", content: "noindex" }] };
  const t = page.seo_title || `${page.title} — ${SITE}`;
  const d = page.seo_description || page.intro.slice(0, 160) || fallbackDesc;
  return {
    meta: [
      { title: t }, { name: "description", content: d },
      { property: "og:title", content: t }, { property: "og:description", content: d },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: path }],
  };
}

export function CmsPage({ page, eyebrow, fallbackTitle }: { page: PublicPage | null; eyebrow: string; fallbackTitle: string }) {
  if (!page) return (
    <PageShell>
      <PageHeading eyebrow={eyebrow} title={fallbackTitle} />
      <div className="px-5 py-14 lg:px-14">
        <div className="max-w-2xl border border-gold/40 bg-surface-deep p-8">
          <p className="eyebrow text-gold">W przygotowaniu</p>
          <p className="mt-4 text-[0.95rem] leading-[1.75] text-foreground/80">Ta strona jest właśnie przygotowywana. Wróć wkrótce — a tymczasem zajrzyj do społeczności.</p>
          <Link to="/spolecznosc" className="mt-6 inline-block bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground hover:bg-gold-bright">Przejdź do społeczności</Link>
        </div>
      </div>
    </PageShell>
  );
  return <PageView eyebrow={eyebrow} title={page.title} intro={page.intro} sections={page.sections} imageSrc={(f) => pageImageUrl(page.id, f)} />;
}
