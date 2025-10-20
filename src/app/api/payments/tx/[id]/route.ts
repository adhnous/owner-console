import { NextResponse } from 'next/server';
import { requireAuthedUser } from '@/lib/server-auth';
import { getTransaction } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  const authz = await requireAuthedUser(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const p: any = await (ctx as any).params;
  const id = (p?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const tx = await getTransaction(id);
  if (!tx) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(tx.uid) !== authz.uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  return NextResponse.json({ ok: true, tx });
}
