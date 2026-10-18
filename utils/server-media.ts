// Server-only upload validation + serialization helpers.

import { CURRENT_YEAR, GalleryItem } from './media';

interface GalleryItemLike {
  publicId: string;
  url: string;
  title: string;
  year: number;
  description?: string | null;
  order: number;
  width?: number | null;
  height?: number | null;
}

export function toGalleryItem(doc: GalleryItemLike): GalleryItem {
  return {
    publicId: doc.publicId,
    url: doc.url,
    title: doc.title,
    year: doc.year,
    description: doc.description ?? '',
    order: doc.order,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
  };
}

// Basename-only, lowercase, safe charset, whitelisted extension. Returns null if unusable.
export function sanitizeFilename(name: string): string | null {
  const base = name
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '') ?? '';
  if (!base || base.startsWith('.')) return null;
  return base;
}

export function stemOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

export function prettifyStem(stem: string): string {
  return stem.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// Detect real image type from magic bytes; author backstop for uploads.
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.subarray(0, 8).equals(pngSig)) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  if (
    buf.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['avif', 'avis'].includes(buf.subarray(8, 12).toString('ascii'))
  ) {
    return 'avif';
  }
  return null;
}

export function clampYear(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2200, Math.max(1900, n));
}

export { CURRENT_YEAR };
