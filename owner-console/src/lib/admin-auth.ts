import { getAdmin } from '@/lib/firebase-admin';

export async function requireOwnerOrAdmin(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { ok: false, code: 401 as const, error: 'missing_token' };
  }
  const token = authHeader.slice(7);
  const { auth, db } = await getAdmin();
  // Step 1: verify token
  let decoded: any;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (e) {
    return { ok: false as const, code: 401 as const, error: 'invalid_token' };
  }
  const uid = decoded.uid as string;
  // Step 2: check role
  try {
    const snap = await db.collection('users').doc(uid).get();
    const role = (snap.exists ? (snap.get('role') as string) : null) || null;
    if (role === 'owner' || role === 'admin') {
      return { ok: true as const, uid, role };
    }
    return { ok: false as const, code: 403 as const, error: 'forbidden' };
  } catch (e: any) {
    return { ok: false as const, code: 500 as const, error: 'role_lookup_failed' };
  }
}
