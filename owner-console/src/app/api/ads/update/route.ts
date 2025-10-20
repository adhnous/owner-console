import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const next: Record<string, any> = {};
  if (typeof body?.text === 'string') next.text = body.text.trim();
  if (typeof body?.textAr === 'string') next.textAr = body.textAr.trim();
  if (typeof body?.href === 'string') next.href = body.href.trim();
  if (typeof body?.active === 'boolean') next.active = body.active;
  if (Number.isFinite(body?.priority)) next.priority = Number(body.priority);
  if (typeof body?.color === 'string') {
    const allowed = ['copper','power','dark','light'];
    next.color = allowed.includes(body.color) ? body.color : 'copper';
  }

  const { db } = await getAdmin();
  await db.collection('ads').doc(id).set(next, { merge: true });
  return NextResponse.json({ ok: true });
}
