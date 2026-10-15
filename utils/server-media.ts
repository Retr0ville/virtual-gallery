// Server-only media storage helpers. Used by pages/api/media.ts and pages/api/upload.ts.
// Storage: public/gallery/<file> for images, data/gallery.json for metadata.

import fs from 'fs';
import path from 'path';
import {
  CURRENT_YEAR,
  GalleryItem,
  IMAGE_EXTS,
  Manifest,
  ManifestEntry,
} from './media';

export const GALLERY_DIR = path.join(process.cwd(), 'public', 'gallery');
export const DATA_DIR = path.join(process.cwd(), 'data');
export const MANIFEST_PATH = path.join(DATA_DIR, 'gallery.json');

export function ensureDirs(): void {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readManifest(): Manifest {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed && parsed.version === 1 && parsed.items && typeof parsed.items === 'object') {
      return parsed;
    }
  } catch {
    // Missing or corrupt manifest — start fresh.
  }
  return { version: 1, items: {} };
}

export function writeManifest(manifest: Manifest): void {
  ensureDirs();
  const tmp = MANIFEST_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, MANIFEST_PATH);
}

// Basename-only, lowercase, safe charset, whitelisted extension. Returns null if unusable.
export function sanitizeFilename(name: string): string | null {
  const base = path
    .basename(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
  if (!base || base.startsWith('.')) return null;
  const ext = base.split('.').pop() ?? '';
  if (!(IMAGE_EXTS as readonly string[]).includes(ext)) return null;
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

export function uniquify(filename: string): string {
  const ext = path.extname(filename);
  const stem = filename.slice(0, -ext.length) || 'image';
  let candidate = filename;
  let n = 2;
  while (fs.existsSync(path.join(GALLERY_DIR, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

function itemFromFile(filename: string, manifest: Manifest): GalleryItem {
  const entry = manifest.items[filename];
  const stem = stemOf(filename);
  let mtimeYear = CURRENT_YEAR;
  try {
    mtimeYear = fs.statSync(path.join(GALLERY_DIR, filename)).mtime.getFullYear();
  } catch {
    // File vanished mid-read — fall back to current year.
  }
  return {
    filename,
    url: `/gallery/${encodeURIComponent(filename)}`,
    title: entry?.title ?? prettifyStem(stem),
    year: entry?.year ?? mtimeYear,
    description: entry?.description ?? '',
    order: entry?.order ?? 0,
  };
}

export function readGalleryItems(): GalleryItem[] {
  ensureDirs();
  const manifest = readManifest();
  const files = fs.readdirSync(GALLERY_DIR).filter((f) => {
    const ext = f.split('.').pop()?.toLowerCase() ?? '';
    return (IMAGE_EXTS as readonly string[]).includes(ext);
  });
  return files.map((f) => itemFromFile(f, manifest));
}

export function galleryItem(filename: string): GalleryItem | null {
  if (!fs.existsSync(path.join(GALLERY_DIR, filename))) return null;
  return itemFromFile(filename, readManifest());
}

export function nextOrderForYear(items: GalleryItem[], year: number): number {
  const orders = items.filter((i) => i.year === year).map((i) => i.order);
  return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

export function clampYear(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2200, Math.max(1900, n));
}

export function manifestEntryFor(filename: string, prev: ManifestEntry | undefined, overrides: Partial<ManifestEntry>): ManifestEntry {
  return {
    title:
      typeof overrides.title === 'string' && overrides.title.trim()
        ? overrides.title.trim().slice(0, 200)
        : prev?.title ?? prettifyStem(stemOf(filename)),
    year: overrides.year !== undefined ? clampYear(overrides.year, prev?.year ?? CURRENT_YEAR) : prev?.year ?? CURRENT_YEAR,
    description:
      typeof overrides.description === 'string'
        ? overrides.description.slice(0, 1000)
        : prev?.description ?? '',
    order:
      overrides.order !== undefined && Number.isFinite(Number(overrides.order))
        ? Number(overrides.order)
        : prev?.order ?? 0,
  };
}
