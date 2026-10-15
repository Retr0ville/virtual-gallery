import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import {
  GALLERY_DIR,
  galleryItem,
  manifestEntryFor,
  readGalleryItems,
  readManifest,
  sanitizeFilename,
  writeManifest,
} from '../../utils/server-media';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ items: readGalleryItems() });
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const safe = sanitizeFilename(String(body.filename ?? ''));
    if (!safe || !fs.existsSync(path.join(GALLERY_DIR, safe))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const manifest = readManifest();
    manifest.items[safe] = manifestEntryFor(safe, manifest.items[safe], {
      title: body.title as string | undefined,
      year: body.year as number | undefined,
      description: body.description as string | undefined,
      order: body.order as number | undefined,
    });
    writeManifest(manifest);
    return res.status(200).json({ item: galleryItem(safe) });
  }

  if (req.method === 'DELETE') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const safe = sanitizeFilename(String(body.filename ?? ''));
    if (!safe) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(GALLERY_DIR, safe);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const manifest = readManifest();
    delete manifest.items[safe];
    writeManifest(manifest);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
