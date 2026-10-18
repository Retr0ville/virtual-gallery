import type { NextApiRequest, NextApiResponse } from 'next';
import { type UploadApiResponse } from 'cloudinary';
import { CURRENT_YEAR } from '../../utils/media';
import { CLOUDINARY_FOLDER, cloudinary } from '../../utils/cloudinary';
import { connectToDatabase } from '../../utils/db';
import { GalleryItemModel } from '../../utils/models/GalleryItem';
import { requireAdmin } from '../../utils/server-auth';
import {
  clampYear,
  prettifyStem,
  sanitizeFilename,
  sniffImage,
  stemOf,
  toGalleryItem,
} from '../../utils/server-media';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 25 * 1024 * 1024;

class PayloadTooLargeError extends Error {}

async function readBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BYTES) throw new PayloadTooLargeError();
    chunks.push(buf);
  }
  return Buffer.concat(chunks, total);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req, res))) return;

  const nameHeader = req.headers['x-file-name'];
  const rawName = Array.isArray(nameHeader) ? nameHeader[0] : nameHeader;
  let name = '';
  try {
    name = rawName ? decodeURIComponent(rawName) : '';
  } catch {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const typeHeader = req.headers['content-type'];
  const contentType = Array.isArray(typeHeader) ? typeHeader[0] : typeHeader;
  if (!name || !contentType?.startsWith('image/')) {
    return res.status(400).json({ error: 'An image file is required' });
  }

  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 25MB)' });
  }

  let buf: Buffer;
  try {
    buf = await readBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      return res.status(413).json({ error: 'Image too large (max 25MB)' });
    }
    console.error('Upload body read failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }

  if (buf.length === 0) {
    return res.status(400).json({ error: 'Empty upload' });
  }

  const sniffedExt = sniffImage(buf);
  if (!sniffedExt) {
    return res.status(400).json({ error: 'Unsupported image format (jpg, png, webp, avif)' });
  }

  // Sanitized stem becomes the Cloudinary public_id prefix.
  const sanitized = sanitizeFilename(name);
  const stem = sanitized ? stemOf(sanitized) : `image-${Date.now()}`;

  const yearHeader = req.headers['x-upload-year'];
  const year = clampYear(Array.isArray(yearHeader) ? yearHeader[0] : yearHeader, CURRENT_YEAR);

  try {
    await connectToDatabase();

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_FOLDER,
          public_id: stem,
          unique_filename: true,
          overwrite: false,
          resource_type: 'image',
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            return reject(error ?? new Error('Cloudinary upload failed'));
          }
          resolve(uploaded);
        }
      );
      stream.end(buf);
    });

    const last = await GalleryItemModel.findOne({ year })
      .sort({ order: -1 })
      .select('order')
      .lean();

    let doc;
    try {
      doc = await GalleryItemModel.create({
        publicId: result.public_id,
        url: result.secure_url,
        title: prettifyStem(stem) || stem,
        year,
        description: '',
        order: last ? last.order + 1 : 1,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      });
    } catch (dbError) {
      // Don't leave an orphaned asset when metadata persistence fails.
      await cloudinary.uploader
        .destroy(result.public_id, { resource_type: 'image', invalidate: true })
        .catch(() => undefined);
      throw dbError;
    }

    return res.status(200).json({ item: toGalleryItem(doc) });
  } catch (err) {
    console.error('Upload failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
