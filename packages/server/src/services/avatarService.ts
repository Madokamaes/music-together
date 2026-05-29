import sharp from 'sharp'

export const AVATAR_LIMIT_BYTES = 5 * 1024 * 1024
export const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function normalizeAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 16_000_000 })
    .rotate()
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 80, effort: 4 })
    .toBuffer()
}
