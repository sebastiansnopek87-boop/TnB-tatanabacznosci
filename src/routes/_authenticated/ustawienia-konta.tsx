import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LogOut } from 'lucide-react';
import { PageShell } from '@/components/tnb/PageShell';
import { Button } from '@/components/ui/button';
import { ProfileCard, PasswordCard, AccountSection } from '@/components/account/AccountForms';
import { AvatarEditor } from '@/components/account/AvatarEditor';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { accountName } from '@/lib/avatar-rules';
export const Route = createFileRoute('/_authenticated/ustawienia-konta')({
  head: () => ({ meta: [
    { title: 'Ustawienia konta — Tata Na Baczności' },
    { name: 'description', content: 'Twój profil, avatar i bezpieczeństwo konta TNB.' },
    { property: 'og:title', content: 'Ustawienia konta — Tata Na Baczności' },
    { property: 'og:description', content: 'Profil i ustawienia Twojego konta TNB.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }), component: Settings,
});
function Settings() {
  const { user } = useAuth(); const qc = useQueryClient(); const navigate = useNavigate();
  async function signOut() { await qc.cancelQueries(); qc.clear(); await navigate({ to: '/', replace: true }); await supabase.auth.signOut(); }
  return <PageShell><div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
    <Button variant="ghost" asChild className="mb-5 px-0 text-gold"><Link to="/moje-tnb"><ArrowLeft />Moje TNB</Link></Button>
    <h1 className="font-display text-3xl text-foreground">Ustawienia konta</h1>
    {user && <>
      <AccountSection title="Avatar"><AvatarEditor name={accountName(user.user_metadata)} /></AccountSection>
      <div className="grid min-w-0 gap-x-10 lg:grid-cols-2">
        <ProfileCard user={user} onSaved={() => {}} />
        <div className="min-w-0"><PasswordCard email={user.email ?? ''} /><AccountSection title="Sesja"><Button variant="outline" onClick={signOut}><LogOut />Wyloguj się</Button></AccountSection></div>
      </div>
    </>}
  </div></PageShell>;
}
