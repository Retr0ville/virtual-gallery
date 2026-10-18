import type { NextApiRequest, NextApiResponse } from 'next';
import {
  isAdmin,
  setAdminSession,
  verifyCredentials,
} from '../../utils/server-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: await isAdmin(req) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Name and password are required' });
  }

  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'Wrong name or password' });
  }

  try {
    await setAdminSession(res, username);
  } catch (err) {
    console.error('Admin login failed:', err);
    return res.status(500).json({ error: 'Login failed' });
  }

  return res.status(200).json({ ok: true });
}
