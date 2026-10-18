export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_SOURCE_MAX_DIMENSION = 4096;
export const AVATAR_SIZE = 384;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validateAvatarSource(type: string, size: number, width: number, height: number) {
  if (!AVATAR_TYPES.includes(type)) throw new Error('Wybierz obraz JPG, PNG lub WebP.');
  if (size <= 0 || size > AVATAR_MAX_BYTES) throw new Error('Obraz może mieć maksymalnie 5 MB.');
  if (width < 1 || height < 1 || width > AVATAR_SOURCE_MAX_DIMENSION || height > AVATAR_SOURCE_MAX_DIMENSION) throw new Error('Obraz może mieć maksymalnie 4096 × 4096 pikseli.');
}
export function accountName(metadata: Record<string, unknown>) {
  return typeof metadata['first_name'] === 'string' ? metadata['first_name'].trim() : '';
}
