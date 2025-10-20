import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const textAr = typeof body?.textAr === 'string' ? body.textAr.trim() : '';
  const href = typeof body?.href === 'string' ? body.href.trim() : '';
  const rawColor = typeof body?.color === 'string' ? body.color : 'copper';
  const allowed = ['copper','power','dark','light'];
  const color = allowed.includes(rawColor) ? rawColor : 'copper';
  const active = !!body?.active;
  const priority = Number.isFinite(body?.priority) ? Number(body.priority) : 0;

  if (!text && !textAr) {
    return NextResponse.json({ error: 'text_required' }, { status: 400 });
  }

  const { db, FieldValue } = await getAdmin();
  const doc = await db.collection('ads').add({
    text,
    textAr,
    href,
    color,
    active,
    priority,
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true, id: doc.id });
}
