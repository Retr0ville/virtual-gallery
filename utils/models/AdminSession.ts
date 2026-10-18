// MongoDB-backed admin sessions. Tokens expire via TTL index and are checked
// on every privileged request.

import { InferSchemaType, Model, Schema, model, models } from 'mongoose';

const AdminSessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export type AdminSessionDoc = InferSchemaType<typeof AdminSessionSchema>;

export const AdminSessionModel: Model<AdminSessionDoc> =
  (models.AdminSession as Model<AdminSessionDoc>) ??
  model<AdminSessionDoc>('AdminSession', AdminSessionSchema);
