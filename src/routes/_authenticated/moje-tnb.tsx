import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, FolderOpen, CalendarDays, MessageCircle, Settings, ArrowUpRight, Shield } from 'lucide-react';
import { getAdminStatus } from '@/lib/admin.functions';
import { PageShell } from '@/components/tnb/PageShell';
import { Button } from '@/components/ui/button';
import { MyMeetings } from '@/components/consult/MyMeetings';
import { MyEvents } from '@/components/meetings/MyEvents';
import { MyArticles, MyPurchases } from '@/components/account/MyCollections';
import { UserAvatar } from '@/components/account/UserAvatar';
import { useAuth } from '@/hooks/use-auth';
import { accountName } from '@/lib/avatar-rules';
import type { ReactNode } from 'react';
export const Route = createFileRoute('/_authenticated/moje-tnb')({
  head: () => ({ meta: [
    { title: 'Moje TNB — Tata Na Baczności' },
    { name: 'description', content: 'Twoje materiały, spotkania, rozmowy i zapisane artykuły w TNB.' },
    { property: 'og:title', content: 'Moje TNB — Tata Na Baczności' },
    { property: 'og:description', content: 'Twoja przestrzeń: materiały, spotkania i zapisane treści.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }), component: MojeTnb,
});
function MojeTnb() {
  const { user } = useAuth(); const adminFn = useServerFn(getAdminStatus);
  const admin = useQuery({ queryKey: ['admin-status', user?.id], queryFn: () => adminFn(), enabled: !!user });
  const name = user ? accountName(user.user_metadata) : '';
  function jump(id: string) { const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ behavior: 'instant', block: 'start' }); el.focus({ preventScroll: true }); }
  return <PageShell><div className="mx-auto max-w-[1200px] px-5 py-6 lg:px-10 lg:py-10">
    {admin.data?.isAdmin && <div className="mb-5 flex justify-end"><Button asChild variant="outline" className="border-gold/40 text-gold"><Link to="/admin"><Shield className="size-4" />Panel administracyjny<ArrowUpRight className="size-4" /></Link></Button></div>}
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-4"><UserAvatar own name={name} className="size-14 text-xl sm:size-16" /><div className="min-w-0"><p className="mb-1 text-xs uppercase text-gold">Moje TNB</p><h1 className="break-words font-display text-3xl sm:text-4xl">Witaj{name ? `, ${name}` : ''}</h1></div></div>
      <Button asChild variant="ghost" className="px-0 text-muted-foreground"><Link to="/ustawienia-konta"><Settings className="size-4" />Ustawienia konta</Link></Button>
    </div>
    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Dobrze, że jesteś. Twoje materiały, spotkania i zapisane treści znajdziesz tutaj</p>
    <nav aria-label="Szybkie akcje" className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <QuickAction icon={<BookOpen />} title="Odkrywaj treści" description="Biblioteka TNB" to="/biblioteka" />
      <QuickAction icon={<FolderOpen />} title="Moje materiały" description="Twoja kolekcja" onClick={() => jump('moje-materialy')} />
      <QuickAction icon={<MessageCircle />} title="Umów rozmowę" description="Spotkajmy się 1:1" to="/spotkania/rozmowa-1-1" />
      <QuickAction icon={<CalendarDays />} title="Nadchodzące spotkania" description="Twoje terminy" onClick={() => jump('moje-spotkania')} />
    </nav>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4"><h2 className="font-display text-2xl">Moja przestrzeń</h2><Button variant="ghost" className="h-auto px-0 py-1 text-xs text-gold" onClick={() => jump('zapisane-artykuly')}>Zapisane artykuły<ArrowUpRight className="size-3" /></Button></div>
    {user ? <div className="grid min-w-0 gap-x-10 lg:grid-cols-2">
      <Space id="moje-spotkania" title="Najbliższe spotkania"><MyEvents /></Space>
      <Space id="moje-rozmowy" title="Moje rozmowy"><MyMeetings /></Space>
      <Space id="zapisane-artykuly" title="Zapisane artykuły"><MyArticles uid={user.id} /></Space>
      <Space id="moje-materialy" title="Moje materiały"><MyPurchases /></Space>
    </div> : <p role="status" className="py-8 text-muted-foreground">Ładowanie Twojej przestrzeni…</p>}
  </div></PageShell>;
}
function QuickAction({ icon, title, description, to, onClick }: { icon: ReactNode; title: string; description: string; to?: '/biblioteka' | '/spotkania/rozmowa-1-1'; onClick?: () => void }) {
  const content = <><span className="text-gold [&_svg]:size-5">{icon}</span><span className="min-w-0 flex-1"><span className="block whitespace-normal text-sm font-medium">{title}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span></span><ArrowUpRight className="size-4 shrink-0 text-gold/60" /></>;
  const cls = 'h-auto min-h-16 justify-start gap-3 rounded-sm border-border/60 px-4 py-3 text-left';
  return to ? <Button asChild variant="outline" className={cls}><Link to={to}>{content}</Link></Button> : <Button variant="outline" className={cls} onClick={onClick}>{content}</Button>;
}
function Space({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} tabIndex={-1} aria-labelledby={`${id}-heading`} className="min-w-0 scroll-mt-28 border-b border-border/60 py-6 focus-visible:outline-2 focus-visible:outline-gold"><h3 id={`${id}-heading`} className="mb-4 font-display text-xl">{title}</h3>{children}</section>;
}
