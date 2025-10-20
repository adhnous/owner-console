import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  pricingEnabled: true,
  showForProviders: false,
  showForSeekers: false,
  enforceAfterMonths: 3,
  lockAllToPricing: false,
  lockProvidersToPricing: false,
  lockSeekersToPricing: false,
};

// Reused pagination worker (handles > N docs)
async function forEachQueryDoc(
  db: FirebaseFirestore.Firestore,
  baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
  onDoc: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void> | void,
  pageSize = 500
) {
  let q = baseQuery.limit(pageSize);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) await onDoc(d);
    const last = snap.docs[snap.docs.length - 1];
    if (!last || snap.size < pageSize) break;
    q = baseQuery.startAfter(last).limit(pageSize);
  }
}

export async function GET(req: Request) {
  try {
    const authz = await requireOwnerOrAdmin(req);
    if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

    const { db } = await getAdmin();
    const snap = await db.collection('settings').doc('features').get();
    const data = snap.exists ? snap.data() || {} : {};

    const out = {
      pricingEnabled:
        typeof data.pricingEnabled === 'boolean' ? data.pricingEnabled : DEFAULTS.pricingEnabled,
      showForProviders:
        typeof data.showForProviders === 'boolean' ? data.showForProviders : DEFAULTS.showForProviders,
      showForSeekers:
        typeof data.showForSeekers === 'boolean' ? data.showForSeekers : DEFAULTS.showForSeekers,
      enforceAfterMonths:
        Number.isFinite(data.enforceAfterMonths) ? Number(data.enforceAfterMonths) : DEFAULTS.enforceAfterMonths,
      lockAllToPricing: !!data.lockAllToPricing,
      lockProvidersToPricing: !!data.lockProvidersToPricing,
      lockSeekersToPricing: !!data.lockSeekersToPricing,
    };

    return NextResponse.json({ features: out });
  } catch (err: any) {
    console.error('GET /api/settings/features error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authz = await requireOwnerOrAdmin(req);
    if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

    const { db, admin } = await getAdmin();
    const settingsRef = db.collection('settings').doc('features');

    const body = await req.json().catch(() => ({} as any));

    // Validate & coerce
    const rawMonths = Number(body.enforceAfterMonths ?? DEFAULTS.enforceAfterMonths);
    const months = Number.isFinite(rawMonths) ? Math.max(0, Math.floor(rawMonths)) : DEFAULTS.enforceAfterMonths;

    const next = {
      pricingEnabled: !!body.pricingEnabled,
      showForProviders: !!body.showForProviders,
      showForSeekers: !!body.showForSeekers,
      enforceAfterMonths: months,
      lockAllToPricing: !!body.lockAllToPricing,
      lockProvidersToPricing: !!body.lockProvidersToPricing,
      lockSeekersToPricing: !!body.lockSeekersToPricing,
    };

    // Read previous to detect transitions
    const prevSnap = await settingsRef.get();
    const prev = prevSnap.exists ? prevSnap.data() || {} : {};

    await settingsRef.set(next, { merge: true });

    // Determine provider lock state transitions
    const prevProvidersLocked = !!(prev.lockAllToPricing || prev.lockProvidersToPricing);
    const nextProvidersLocked = !!(next.lockAllToPricing || next.lockProvidersToPricing);

    let updatedDemoted = 0;
    let updatedReapproved = 0;

    if (!prevProvidersLocked && nextProvidersLocked) {
      // Providers just became locked: demote all approved services
      const baseQuery = db.collection('services').where('status', '==', 'approved');
      let batch = db.batch();
      let ops = 0;

      await forEachQueryDoc(db, baseQuery, async (d) => {
        batch.update(d.ref, {
          status: 'pending',
          approvedAt: null,
          approvedBy: null,
          demotedForLock: true,
        });
        ops++;
        updatedDemoted++;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      });

      if (ops > 0) await batch.commit();
    }

    if (prevProvidersLocked && !nextProvidersLocked) {
      // Providers just became unlocked: reapprove any services we demoted for lock
      const baseQuery = db.collection('services').where('status', '==', 'pending');
      let batch = db.batch();
      let ops = 0;

      await forEachQueryDoc(db, baseQuery, async (d) => {
        const s = d.data() || {};
        if (s.demotedForLock === true) {
          batch.update(d.ref, {
            status: 'approved',
            demotedForLock: null,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: authz.uid,
          });
          ops++;
          updatedReapproved++;
          if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
      });

      if (ops > 0) await batch.commit();
    }

    return NextResponse.json({ ok: true, features: next, updatedDemoted, updatedReapproved });
  } catch (err: any) {
    console.error('POST /api/settings/features error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
