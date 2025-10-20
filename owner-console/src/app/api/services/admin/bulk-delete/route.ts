import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim()) : [];
  if (!ids.length) return NextResponse.json({ error: 'no_ids' }, { status: 400 });

  const unique = Array.from(new Set(ids));
  const { db } = await getAdmin();

  let deleted = 0;
  let batch = db.batch();
  let ops = 0;
  for (const id of unique) {
    const ref = db.collection('services').doc(id);
    batch.delete(ref);
    ops++;
    deleted++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  return NextResponse.json({ ok: true, deleted, requested: unique.length });
}
