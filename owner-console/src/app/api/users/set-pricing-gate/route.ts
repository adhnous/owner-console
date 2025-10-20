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
  if (!uid) return NextResponse.json({ error: 'uid_required' }, { status: 400 });

  const { db } = await getAdmin();

  const pg: any = {};
  // mode
  if (body?.mode === 'force_show' || body?.mode === 'force_hide') {
    pg.mode = body.mode;
  } else if (body?.mode === null) {
    pg.mode = null;
  }
  // showAt
  if (body?.showAt) {
    const v = new Date(body.showAt);
    if (!isNaN(v.getTime())) pg.showAt = v;
  } else if (body?.showAt === null) {
    pg.showAt = null;
  }
  // months
  if (body?.enforceAfterMonths != null) {
    const n = Math.max(0, Math.floor(Number(body.enforceAfterMonths)));
    if (Number.isFinite(n)) pg.enforceAfterMonths = n; else pg.enforceAfterMonths = null;
  }

  try {
    const ref = db.collection('users').doc(uid);
    const prevSnap = await ref.get();
    const prevData = prevSnap.data() || {};
    const prevLocked = prevData?.pricingGate?.mode === 'force_show';

    await ref.set({ pricingGate: pg }, { merge: true });
    const snap = await ref.get();
    const data = snap.data() || {};

    // If the user is a provider and the override changed, adjust services accordingly.
    const isProvider = (data?.role === 'provider');
    const nextLocked = (pg?.mode === 'force_show');
    let updatedServices = 0;
    if (isProvider && nextLocked && !prevLocked) {
      // Lock turned ON: demote approved to pending with demotedForLock flag
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
    } else if (isProvider && !nextLocked && prevLocked) {
      // Lock turned OFF: reapprove those that were demoted by lock
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

    return NextResponse.json({ ok: true, pricingGate: data.pricingGate || null, updatedServices });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'update_failed' }, { status: 500 });
  }
}
