import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';
import { saveMyAvatar, removeMyAvatar } from '@/lib/avatar.functions';
import { AVATAR_SIZE, validateAvatarSource } from '@/lib/avatar-rules';

export function AvatarEditor({ name }: { name: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const save = useServerFn(saveMyAvatar); const remove = useServerFn(removeMyAvatar); const qc = useQueryClient();
  async function choose(file?: File) {
    if (!file) return; setMessage(''); setBusy(true);
    try {
      validateAvatarSource(file.type, file.size, 1, 1);
      const bitmap = await createImageBitmap(file);
      try {
        validateAvatarSource(file.type, file.size, bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Nie można odczytać obrazu.');
        const side = Math.min(bitmap.width, bitmap.height);
        ctx.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        const { encode } = await import('@stacksjs/ts-webp');
        const pixels = ctx.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        const bytes = encode({ data: new Uint8Array(pixels.data), width: AVATAR_SIZE, height: AVATAR_SIZE });
        const blob = new Blob([new Uint8Array(bytes)], { type: 'image/webp' });
        setImage(blob);
        setPreview(await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); }));
      } finally { bitmap.close(); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Nie można odczytać obrazu.'); } finally { setBusy(false); }
  }
  async function commit(deleting = false) {
    setBusy(true); setMessage('');
    try {
      if (deleting) await remove(); else { if (!image) return; const form = new FormData(); form.set('image', image, 'avatar.webp'); await save({ data: form }); }
      setImage(null); setPreview(null); await qc.invalidateQueries({ queryKey: ['my-avatar'] });
      setMessage(deleting ? 'Avatar został usunięty.' : 'Avatar został zapisany.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Nie udało się zapisać.'); } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-5">
    {preview ? <img src={preview} alt="Podgląd nowego avatara" className="size-20 rounded-full object-cover" /> : <UserAvatar own name={name} className="size-20 text-2xl" />}
    <div className="min-w-0 space-y-3">
      <label className="block text-sm text-foreground" htmlFor="avatar-file">Zdjęcie profilowe</label>
      <input ref={input} id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} className="sr-only" />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>Wybierz zdjęcie</Button>
      <div className="flex flex-wrap gap-2">
        {image && <><Button disabled={busy} onClick={() => commit()}>Zapisz avatar</Button><Button variant="ghost" disabled={busy} onClick={() => { setImage(null); setPreview(null); }}>Anuluj</Button></>}
        <Button variant="outline" disabled={busy} onClick={() => commit(true)}>Usuń avatar</Button>
      </div>
      {busy && <p role="status" className="text-sm text-muted-foreground">Przetwarzanie…</p>}
      {message && <p role="status" className="max-w-sm text-sm text-foreground">{message}</p>}
    </div>
  </div>;
}
