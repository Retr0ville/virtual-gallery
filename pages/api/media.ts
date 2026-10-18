import type { NextApiRequest, NextApiResponse } from 'next';
import { CURRENT_YEAR } from '../../utils/media';
import { cloudinary } from '../../utils/cloudinary';
import { connectToDatabase } from '../../utils/db';
import { GalleryItemModel } from '../../utils/models/GalleryItem';
import { requireAdmin } from '../../utils/server-auth';
import { clampYear, toGalleryItem } from '../../utils/server-media';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const docs = await GalleryItemModel.find()
        .sort({ year: 1, order: 1, createdAt: 1 })
        .lean();
      return res.status(200).json({ items: docs.map(toGalleryItem) });
    }

    if (req.method === 'PATCH') {
      if (!(await requireAdmin(req, res))) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
      if (!publicId) {
        return res.status(400).json({ error: 'publicId is required' });
      }

      const update: Record<string, string | number> = {};
      if (typeof body.title === 'string' && body.title.trim()) {
        update.title = body.title.trim().slice(0, 200);
      }
      if (typeof body.description === 'string') {
        update.description = body.description.slice(0, 1000);
      }
      if (body.year !== undefined) {
        update.year = clampYear(body.year, CURRENT_YEAR);
      }
      if (body.order !== undefined && Number.isFinite(Number(body.order))) {
        update.order = Number(body.order);
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const doc = await GalleryItemModel.findOneAndUpdate(
        { publicId },
        { $set: update },
        { new: true, runValidators: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: 'Item not found' });

      return res.status(200).json({ item: toGalleryItem(doc) });
    }

    if (req.method === 'DELETE') {
      if (!(await requireAdmin(req, res))) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
      if (!publicId) {
        return res.status(400).json({ error: 'publicId is required' });
      }

      const doc = await GalleryItemModel.findOne({ publicId }).lean();
      if (!doc) return res.status(404).json({ error: 'Item not found' });

      // Trigger Cloudinary's destroy API first. 'not found' is fine — that
      // makes retries idempotent if Mongo deletion failed previously.
      const destroyed = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
      if (destroyed.result !== 'ok' && destroyed.result !== 'not found') {
        return res.status(502).json({ error: `Cloudinary delete failed: ${destroyed.result}` });
      }

      await GalleryItemModel.deleteOne({ publicId });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Media API failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
