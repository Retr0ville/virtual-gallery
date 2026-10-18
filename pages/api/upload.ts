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

  if (!(await requireAdmin(req, res))) return;

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

  // Sanitized stem becomes the Cloudinary public_id prefix.
  const sanitized = sanitizeFilename(name);
  const stem = sanitized ? stemOf(sanitized) : `image-${Date.now()}`;

  const year = clampYear(body.year, CURRENT_YEAR);

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
