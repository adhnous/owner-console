import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseGsPath(url: string): { bucket: string; object: string } | null {
  try {
    if (!url) return null;
    if (url.startsWith('gs://')) {
      const rest = url.slice(5);
      const [bucket, ...parts] = rest.split('/');
      const object = parts.join('/');
      if (bucket && object) return { bucket, object };
      return null;
    }
    const u = new URL(url);
    // Pattern 1: firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>
    if (u.hostname.includes('firebasestorage.googleapis.com')) {
      const seg = u.pathname.split('/').filter(Boolean);
      // [ 'v0', 'b', '<bucket>', 'o', '<encodedPath>' ]
      const bIdx = seg.indexOf('b');
      const oIdx = seg.indexOf('o');
      if (bIdx >= 0 && oIdx >= 0 && seg[bIdx + 1] && seg[oIdx + 1]) {
        const bucket = seg[bIdx + 1];
        const object = decodeURIComponent(seg[oIdx + 1]);
        return { bucket, object };
      }
    }
    // Pattern 2: storage.googleapis.com/<bucket>/<path>
    if (u.hostname.includes('storage.googleapis.com')) {
      const seg = u.pathname.split('/').filter(Boolean);
      const bucket = seg[0];
      const object = seg.slice(1).join('/');
      if (bucket && object) return { bucket, object };
    }
  } catch {}
  return null;
}

// POST /api/service-deletions/decide { id, action: 'approve' | 'reject' }
export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const id = (body?.id || '').trim();
  const action = (body?.action || '').trim();
  if (!id || !['approve','reject'].includes(action)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { db, bucket } = await getAdmin();
  const reqRef = db.collection('service_deletion_requests').doc(id);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const data = reqSnap.data() || {};
  const serviceId = data.serviceId as string | undefined;
  if (!serviceId) return NextResponse.json({ error: 'no_service' }, { status: 400 });

  const svcRef = db.collection('services').doc(serviceId);
  const now = new Date();

  if (action === 'approve') {
    // Delete Storage media then the service doc
    const svcSnap = await svcRef.get();
    if (svcSnap.exists) {
      const svcData = svcSnap.data() || {};
      const images: any[] = Array.isArray(svcData.images) ? svcData.images : [];
      if (bucket) {
        const bucketName = (bucket as any).name ? (bucket as any).name : '';
        const deletions: Promise<any>[] = [];
        for (const img of images) {
          const url = typeof img?.url === 'string' ? img.url : '';
          const parsed = parseGsPath(url);
          if (parsed && parsed.bucket && parsed.object && (!bucketName || parsed.bucket === bucketName)) {
            const f = bucket.file(parsed.object);
            deletions.push(f.delete().catch(() => {}));
          }
        }
        await Promise.allSettled(deletions);
      }
      await svcRef.delete();
    }
    await reqRef.set({ status: 'approved', approvedAt: now, approvedBy: authz.uid }, { merge: true });
    return NextResponse.json({ ok: true, id, action: 'approved' });
  } else {
    // Reject: revert service status and remove pendingDelete flag
    const priorStatus = data.priorStatus || 'approved';
    await svcRef.set({ status: priorStatus, pendingDelete: false }, { merge: true });
    await reqRef.set({ status: 'rejected', approvedAt: now, approvedBy: authz.uid }, { merge: true });
    return NextResponse.json({ ok: true, id, action: 'rejected' });
  }
}
