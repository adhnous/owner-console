import { getAdmin } from '@/lib/firebase-admin';

export type ProviderType = 'mock' | 'fawri' | 'aman';

export type Transaction = {
  id?: string;
  uid: string;
  planId: 'basic' | 'pro' | 'enterprise';
  amount: number;
  currency: string; // e.g., 'LYD'
  provider: ProviderType;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  createdAt: Date | any;
  paidAt?: Date | any | null;
  checkoutUrl?: string | null;
  providerRef?: string | null;
  meta?: Record<string, any>;
};

export async function createTransaction(opts: {
  uid: string;
  planId: 'basic' | 'pro' | 'enterprise';
  amount: number;
  currency: string;
  provider: ProviderType;
  origin?: string;
}): Promise<{ id: string; checkoutUrl: string }>{
  const { db } = await getAdmin();
  const ref = db.collection('transactions').doc();
  const checkoutUrl = `${opts.origin || ''}/checkout/${ref.id}`;
  const payload: Transaction = {
    uid: opts.uid,
    planId: opts.planId,
    amount: opts.amount,
    currency: opts.currency,
    provider: opts.provider,
    status: 'pending',
    createdAt: new Date(),
    checkoutUrl,
  };
  await ref.set(payload, { merge: true });
  return { id: ref.id, checkoutUrl };
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { db } = await getAdmin();
  const snap = await db.collection('transactions').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return { id: snap.id, ...(data as any) } as Transaction;
}

export async function markTransactionPaid(id: string, approverUid?: string) {
  const { db } = await getAdmin();
  const ref = db.collection('transactions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not_found');
  const tx = snap.data() as any;
  if (tx.status === 'success') return { ok: true, already: true };

  // Update transaction and user's plan atomically when possible
  const userRef = db.collection('users').doc(String(tx.uid));
  await db.runTransaction(async (t: any) => {
    const uSnap = await t.get(userRef);
    if (!uSnap.exists) throw new Error('user_not_found');
    t.update(ref, { status: 'success', paidAt: new Date(), approvedBy: approverUid || null });
    // Set plan and clear per-user pricing lock if present
    t.update(userRef, { plan: tx.planId, ['pricingGate.mode']: null } as any);
  });

  // After payment, reapprove any of this provider's services that were demoted by lock
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
        batch.update(d.ref, { status: 'approved', demotedForLock: null, approvedAt: new Date(), approvedBy: approverUid || 'system' });
        ops++;
        if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
    }
    if (ops > 0) { await batch.commit(); }
  } catch (e) {
    // non-fatal
  }

  return { ok: true };
}
