import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArticleView } from "@/components/articles/ArticleView";
import { ArticleInteractions } from "@/components/articles/ArticleInteractions";
import { PageHeading, PageShell } from "@/components/tnb/PageShell";
import { articleCategoriesQuery, articleImageUrl, articleQuery } from "@/lib/articles";

export const Route = createFileRoute("/artykuly/$slug")({
  loader: async ({ context, params }) => {
    const a = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!a) throw notFound();
    return { title: a.seo_title || `${a.title} — Tata Na Baczności`, description: a.seo_description || a.excerpt.slice(0, 170) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Nie znaleziono artykułu — Tata Na Baczności" }, { name: "robots", content: "noindex" }] };
    return {
      meta: [
        { title: loaderData.title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: ArticleNotFound,
  component: ArticlePage,
});

function ArticleNotFound() {
  return (
    <PageShell>
      <PageHeading eyebrow="Artykuły" title="Nie znaleziono artykułu" intro="Ten artykuł nie istnieje albo nie jest już dostępny." />
      <div className="px-5 py-10 lg:px-14"><Link to="/artykuly" className="text-gold underline">Wróć do listy artykułów</Link></div>
    </PageShell>
  );
}

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data: a } = useSuspenseQuery(articleQuery(slug));
  const cats = useQuery(articleCategoriesQuery());
  if (!a) return <ArticleNotFound />;
  const cat = cats.data?.find((c) => c.slug === a.category)?.name ?? null;
  return (
    <ArticleView title={a.title} excerpt={a.excerpt} category={cat} author={a.author_name} publishedAt={a.published_at} minutes={a.reading_minutes}
      cover={a.cover ? articleImageUrl(a.id, a.cover, a.updated_at) : undefined} coverAlt={a.cover_alt} sections={a.sections}
      imageSrc={(f) => articleImageUrl(a.id, f, a.updated_at)} after={<ArticleInteractions key={a.id} a={a} />} />
  );
}
