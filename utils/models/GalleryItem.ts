// MongoDB shape for one gallery artwork. `publicId` is Cloudinary's stable
// identifier and the primary key used by update/delete.

import { InferSchemaType, Model, Schema, model, models } from 'mongoose';

const GalleryItemSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    year: { type: Number, required: true, min: 1900, max: 2200, index: true },
    description: { type: String, default: '', maxlength: 1000 },
    order: { type: Number, required: true, default: 0 },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
    bytes: { type: Number },
  },
  { timestamps: true }
);

export type GalleryItemDoc = InferSchemaType<typeof GalleryItemSchema>;

// Reuse the compiled model across hot reloads to avoid OverwriteModelError.
export const GalleryItemModel: Model<GalleryItemDoc> =
  (models.GalleryItem as Model<GalleryItemDoc>) ??
  model<GalleryItemDoc>('GalleryItem', GalleryItemSchema);
