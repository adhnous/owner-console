import { getAdmin } from '@/lib/firebase-admin';

export async function requireAuthedUser(req: Request): Promise<{ ok: true; uid: string; email?: string | null } | { ok: false; code: number; error: string } > {
  try {
    const authz = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (!m) return { ok: false, code: 401, error: 'missing_token' };
    const token = m[1];
    const { auth } = await getAdmin();
    const decoded = await auth.verifyIdToken(token, true);
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
  } catch (e: any) {
    return { ok: false, code: 401, error: 'invalid_token' };
  }
}
