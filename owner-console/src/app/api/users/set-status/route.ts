import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const uid = (body?.uid || '').trim();
  const status = (body?.status || '').trim();
  if (!uid) return NextResponse.json({ error: 'uid_required' }, { status: 400 });
  if (!['active', 'disabled'].includes(status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 });

  try {
    const { db } = await getAdmin();
    const ref = db.collection('users').doc(uid);
    const prevSnap = await ref.get();
    const prevData = prevSnap.data() || {};
    const prevStatus = prevData?.status || 'active';
    await ref.set({ status }, { merge: true });
    const snap = await ref.get();
    const data = snap.data() || {};

    let updatedServices = 0;
    if (status === 'disabled' && data?.role === 'provider') {
      const svcSnap = await db.collection('services').where('providerId', '==', uid).limit(1000).get();
      let batch = db.batch();
      let ops = 0;
      for (const d of svcSnap.docs) {
        const s = d.data() || {};
        if (s.status === 'approved') {
          batch.update(d.ref, { status: 'pending', approvedAt: null, approvedBy: null, demotedForLock: true });
          ops++;
          updatedServices++;
          if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
        }
      }
      if (ops > 0) { await batch.commit(); }
    } else if (prevStatus === 'disabled' && status === 'active' && data?.role === 'provider') {
      // Re-enable: reapprove services that were demoted by lock
      const svcSnap = await db.collection('services').where('providerId', '==', uid).where('status', '==', 'pending').limit(1000).get();
      let batch = db.batch();
      let ops = 0;
      for (const d of svcSnap.docs) {
        const s = d.data() || {};
        if (s.demotedForLock === true) {
          batch.update(d.ref, { status: 'approved', demotedForLock: null, approvedAt: new Date(), approvedBy: authz.uid });
          ops++;
          updatedServices++;
          if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
        }
      }
      if (ops > 0) { await batch.commit(); }
    }

    return NextResponse.json({ ok: true, status: data.status || 'active', updatedServices });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'set_status_failed' }, { status: 500 });
  }
}
