import { describe, it, expect } from 'vitest';
import { validateAvatarSource, accountName, AVATAR_SIZE } from './avatar-rules';
import { encode, decode, getWebpInfo, parseRiff } from '@stacksjs/ts-webp';
describe('avatar rules', () => {
  it('accepts JPEG PNG and WebP', () => { for (const type of ['image/jpeg','image/png','image/webp']) expect(() => validateAvatarSource(type, 1024, 384, 384)).not.toThrow(); });
  it('rejects SVG', () => { expect(() => validateAvatarSource('image/svg+xml', 1024, 384, 384)).toThrow(); });
  it('enforces 5 MB limit', () => { expect(() => validateAvatarSource('image/png', 5*1024*1024+1, 384, 384)).toThrow(); expect(() => validateAvatarSource('image/png',5*1024*1024,384,384)).not.toThrow(); });
  it('enforces 4096 pixel limit', () => { expect(() => validateAvatarSource('image/png',1024,4097,384)).toThrow(); expect(() => validateAvatarSource('image/png',1024,4096,4096)).not.toThrow(); });
  it('uses real first name and no invented fallback', () => { expect(accountName({ first_name: ' Anna ' })).toBe('Anna'); expect(accountName({ nick: 'Nickname' })).toBe(''); expect(accountName(null)).toBe(''); });
  it('normalizes to decodable 384 pixel WebP', () => { const rgba = new Uint8Array(AVATAR_SIZE*AVATAR_SIZE*4).fill(180); const bytes = encode({data:rgba,width:384,height:384}); const decoded=decode(bytes); expect(decoded.width).toBe(384); expect(decoded.height).toBe(384); expect(decoded.data).toEqual(rgba); expect(getWebpInfo(parseRiff(bytes)).hasAnimation).toBe(false); });
});
