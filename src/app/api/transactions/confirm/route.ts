import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({} as any));
  const id = (body?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const { db } = await getAdmin();
  const txRef = db.collection('transactions').doc(id);
  const snap = await txRef.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const tx = snap.data() || {};
  if (tx.status === 'success') return NextResponse.json({ ok: true, already: true });

  const userRef = db.collection('users').doc(String(tx.uid));
  await db.runTransaction(async (t: any) => {
    const uSnap = await t.get(userRef);
    if (!uSnap.exists) throw new Error('user_not_found');
    t.update(txRef, { status: 'success', paidAt: new Date(), approvedBy: authz.uid });
    // Set plan and clear per-user pricing lock if present
    t.update(userRef, { plan: tx.planId, ['pricingGate.mode']: null } as any);
  });

  // Reapprove any services demoted by lock for this provider
  try {
    const svcSnap = await db
      .collection('services')
      .where('providerId', '==', String(tx.uid))
      .where('status', '==', 'pending')
      .limit(1000)
      .get();
    let batch = db.batch();
    let ops = 0;
    for (const d of svcSnap.docs) {
      const s = d.data() || {};
      if (s.demotedForLock === true) {
        batch.update(d.ref, { status: 'approved', demotedForLock: null, approvedAt: new Date(), approvedBy: authz.uid });
        ops++;
        if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
    }
    if (ops > 0) { await batch.commit(); }
  } catch (e) {
    // non-fatal
  }

  return NextResponse.json({ ok: true });
}
