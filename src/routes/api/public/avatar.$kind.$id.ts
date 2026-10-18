import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/avatar/$kind/$id')({ server: { handlers: {
  GET: async ({ request, params }) => {
    const denied = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    if (!/^[0-9a-f-]{36}$/.test(params.id) || !['own', 'post', 'comment'].includes(params.kind)) return denied();
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    let viewer: string | null = null;
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (token) { const { data, error } = await db.auth.getUser(token); if (error || !data.user) return denied(); viewer = data.user.id; }
    let owner: string | null = null;
    if (params.kind === 'own') { if (viewer !== params.id) return denied(); owner = viewer; }
    else {
      let postId = params.id;
      if (params.kind === 'comment') {
        const { data: c } = await db.from('community_comments').select('post_id,author_id').eq('id', params.id).maybeSingle();
        if (!c) return denied(); postId = c.post_id; owner = c.author_id;
      }
      const { data: p } = await db.from('community_posts').select('author_id,status,visibility').eq('id', postId).maybeSingle();
      if (!p) return denied();
      if (p.status !== 'published') {
        if (!viewer) return denied();
        const { data: admin } = await db.rpc('has_role', { _user_id: viewer, _role: 'admin' });
        if (viewer !== p.author_id && !admin) return denied();
      } else if (p.visibility !== 'public' && !viewer) return denied();
      if (params.kind === 'post') owner = p.author_id;
    }
    if (!owner) return denied();
    const { data: avatar } = await db.from('user_avatars').select('object_path').eq('user_id', owner).maybeSingle();
    if (!avatar || !avatar.object_path.startsWith(`avatars/${owner}/`)) return denied();
    const { data: blob, error } = await db.storage.from('media').download(avatar.object_path);
    if (!blob || error) return denied();
    return new Response(blob, { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  }
} } });
