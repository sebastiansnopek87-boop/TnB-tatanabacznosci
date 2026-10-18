import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { AVATAR_MAX_BYTES, AVATAR_SIZE } from './avatar-rules';

export const getMyAvatar = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('user_avatars').select('object_path').eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error('Nie udało się wczytać avatara.');
  return data ? `/api/public/avatar/own/${context.userId}?v=${data.object_path.split('/').pop()}` : null;
});
export const saveMyAvatar = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error('Nieprawidłowy obraz.');
    if ([...input.keys()].some(k => k !== 'image')) throw new Error('Możesz zmieniać wyłącznie własny avatar.');
    const image = input.get('image');
    if (!(image instanceof Blob) || image.type !== 'image/webp' || image.size > AVATAR_MAX_BYTES || !image.size) throw new Error('Nieprawidłowy obraz.');
    return input;
  }).handler(async ({ data, context }) => {
    const image = data.get('image');
    if (!(image instanceof Blob)) throw new Error('Nieprawidłowy obraz.');
    const { decode, encode, parseRiff, getWebpInfo } = await import('@stacksjs/ts-webp');
    const bytes = new Uint8Array(await image.arrayBuffer());
    const info = getWebpInfo(parseRiff(bytes));
    if (info.width !== AVATAR_SIZE || info.height !== AVATAR_SIZE || info.hasAnimation) throw new Error('Nieprawidłowe wymiary avatara.');
    let normalized: Uint8Array;
    try {
      const decoded = decode(bytes);
      if (decoded.width !== AVATAR_SIZE || decoded.height !== AVATAR_SIZE) throw new Error('size');
      normalized = encode(decoded);
    } catch { throw new Error('Nie można odczytać obrazu.'); }
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const path = `avatars/${context.userId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await db.storage.from('media').upload(path, normalized, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw new Error('Nie udało się przesłać avatara.');
    const { error } = await db.from('user_avatars').upsert({ user_id: context.userId, object_path: path, updated_at: new Date().toISOString() });
    if (error) { await db.storage.from('media').remove([path]); throw new Error('Nie udało się zapisać avatara.'); }
    // Old unique objects remain private and unreferenced; never delete a concurrent save's object.
    return { ok: true };
  });
export const removeMyAvatar = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { error } = await db.from('user_avatars').delete().eq('user_id', context.userId);
  if (error) throw new Error('Nie udało się usunąć avatara.');
  return { ok: true };
});
