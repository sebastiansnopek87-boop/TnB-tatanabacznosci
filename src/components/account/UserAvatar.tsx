import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { getMyAvatar } from '@/lib/avatar.functions';

export function UserAvatar({ name = '', own = false, kind, id, className = 'size-10' }: { name?: string; own?: boolean; kind?: 'post' | 'comment'; id?: string; className?: string }) {
  const auth = useAuth();
  const fn = useServerFn(getMyAvatar);
  const q = useQuery({ queryKey: ['my-avatar', auth.user?.id], queryFn: () => fn(), enabled: own && !!auth.user });
  const path = own ? q.data : kind && id ? `/api/public/avatar/${kind}/${id}` : null;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(null);
    if (!path) return;
    let active = true; let url: string | null = null;
    const controller = new AbortController();
    void (async () => {
      const headers = new Headers();
      if (auth.user) { const { data } = await supabase.auth.getSession(); if (data.session) headers.set('authorization', `Bearer ${data.session.access_token}`); }
      const response = await fetch(path, { headers, signal: controller.signal });
      if (!response.ok) return;
      url = URL.createObjectURL(await response.blob());
      if (active) setSrc(url); else URL.revokeObjectURL(url);
    })().catch(() => {});
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [path, auth.user?.id]);
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-gold/10 font-display text-gold ${className}`}>
    {src ? <img src={src} alt={`Avatar${name ? `: ${name}` : ''}`} className="size-full object-cover" /> : name.trim() ? <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span> : <UserRound aria-hidden className="size-5" />}
  </span>;
}
