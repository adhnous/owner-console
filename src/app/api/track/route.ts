import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const json = (await req.json().catch(() => ({}))) as any;
    const type = typeof json?.type === 'string' ? json.type : '';
    const serviceId = typeof json?.serviceId === 'string' ? json.serviceId : '';
    const city = typeof json?.city === 'string' ? json.city : null;
    const ref = typeof json?.ref === 'string' ? json.ref : null;
    if (!serviceId || !['service_view','cta_click','message_sent'].includes(type)) {
      return NextResponse.json({ error: 'bad_event' }, { status: 400 });
    }

    // Load Admin SDK dynamically; if unavailable, soft-fail (do not break the page)
    let db: any, FieldValue: any;
    try {
      const admin = await getAdmin();
      db = admin.db;
      FieldValue = admin.FieldValue;
    } catch {
      // Analytics disabled: no credentials in dev. Do not error the page.
      return NextResponse.json({ ok: true, skipped: 'admin_unavailable' });
    }

    // Resolve providerUid from service doc
    const svc = await db.collection('services').doc(serviceId).get();
    if (!svc.exists) return NextResponse.json({ error: 'no_service' }, { status: 404 });
    const providerUid = (svc.get('providerId') as string) || '';

    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const statsId = `${serviceId}_${yyyymmdd}`;

    // Raw event (optional)
    await db.collection('events').add({ type, serviceId, providerUid, city, ref, ts: now });

    // Aggregate increment
    const refStats = db.collection('stats_daily').doc(statsId);
    const incField = type === 'service_view' ? 'views' : type === 'cta_click' ? 'ctas' : 'messages';
    await refStats.set(
      {
        serviceId,
        providerUid,
        yyyymmdd,
        [incField]: FieldValue.increment(1),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error)?.message || 'server_error';
    const lower = String(msg || '').toLowerCase();
    if (
      lower.includes('application default credentials') ||
      lower.includes('could not load the default credentials') ||
      lower.includes('missing credentials') ||
      lower.includes('permission denied') ||
      lower.includes('unauthenticated')
    ) {
      return NextResponse.json({ ok: true, skipped: 'admin_unavailable' });
    }
    // Fail-open for analytics: do not break the page on unexpected errors.
    return NextResponse.json({ ok: true, skipped: 'error', error: msg });
  }
}
