import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { CURRENT_YEAR } from '../../utils/media';
import {
  GALLERY_DIR,
  ensureDirs,
  galleryItem,
  nextOrderForYear,
  prettifyStem,
  readGalleryItems,
  readManifest,
  sanitizeFilename,
  sniffImage,
  stemOf,
  uniquify,
  writeManifest,
} from '../../utils/server-media';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '40mb',
    },
  },
};

const MAX_BYTES = 25 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name : '';
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  if (!name || !dataUrl) {
    return res.status(400).json({ error: 'name and dataUrl are required' });
  }

  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  if (!header.startsWith('data:image/')) {
    return res.status(400).json({ error: 'dataUrl must be an image' });
  }

  const base64 = dataUrl.slice(comma + 1);
  if ((base64.length * 3) / 4 > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 25MB)' });
  }

  const buf = Buffer.from(base64, 'base64');
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 25MB)' });
  }

  const sniffedExt = sniffImage(buf);
  if (!sniffedExt) {
    return res.status(400).json({ error: 'Unsupported image format (jpg, png, webp, avif)' });
  }

  // Sanitized stem from the client name; extension always from content sniff.
  const sanitized = sanitizeFilename(name);
  const stem = sanitized ? stemOf(sanitized) : `image-${Date.now()}`;
  const safe = `${stem}.${sniffedExt}`;

  ensureDirs();
  const filename = uniquify(safe);
  fs.writeFileSync(path.join(GALLERY_DIR, filename), buf);

  const manifest = readManifest();
  const items = readGalleryItems();
  manifest.items[filename] = {
    title: prettifyStem(stem) || filename,
    year: CURRENT_YEAR,
    description: '',
    order: nextOrderForYear(items, CURRENT_YEAR),
  };
  writeManifest(manifest);

  return res.status(200).json({ item: galleryItem(filename) });
}
