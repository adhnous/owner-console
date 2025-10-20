import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { markTransactionPaid } from '@/lib/payments-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This route is intended to be called from the owner-console, or
// a secure webhook receiver bridging the local PSP to this API.
export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({} as any));
  const id = (body?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  try {
    const result = await markTransactionPaid(id, authz.uid);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'confirm_failed' }, { status: 500 });
  }
}
