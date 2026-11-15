import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { getMyAvatar } from '@/lib/api/avatar';
import { publicAvatarUrl } from '@/lib/public-assets';

export function UserAvatar({ name = '', own = false, kind, id, className = 'size-10' }: { name?: string; own?: boolean; kind?: 'post' | 'comment'; id?: string; className?: string }) {
  const auth = useAuth();
  const q = useQuery({ queryKey: ['my-avatar', auth.user?.id], queryFn: getMyAvatar, enabled: own && !!auth.user && !auth.user.id.startsWith('00000000-') });
  const path = own ? q.data : kind && id ? publicAvatarUrl(kind, id) : null;
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
