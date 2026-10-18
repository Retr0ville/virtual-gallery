// Server-only admin auth. Successful login creates a random session token in
// MongoDB; the token is sent as an HttpOnly cookie. Mutations must present a
// live session.

import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes, timingSafeEqual } from 'crypto';
import { connectToDatabase } from './db';
import { AdminSessionModel } from './models/AdminSession';

const COOKIE_NAME = 'vg_admin';
const COOKIE_MAX_AGE = 60 * 60 * 8;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME || 'Simi';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'Jasmine';
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPassword);
}

export async function setAdminSession(res: NextApiResponse, username: string): Promise<void> {
  await connectToDatabase();

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);
  await AdminSessionModel.create({ token, username, expiresAt });

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`
  );
}

export async function isAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return false;

  await connectToDatabase();
  const session = await AdminSessionModel.findOne({
    token,
    expiresAt: { $gt: new Date() },
  }).lean();
  return Boolean(session);
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  if (await isAdmin(req)) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
