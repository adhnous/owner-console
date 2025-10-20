import { NextResponse } from 'next/server';
import { requireAuthedUser } from '@/lib/server-auth';
import { createTransaction } from '@/lib/payments-server';
import { plans } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authz = await requireAuthedUser(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({} as any));
  const planId = (body?.planId || '').trim() as 'basic' | 'pro' | 'enterprise';
  const provider = (body?.provider || 'mock').trim();
  if (!['basic', 'pro', 'enterprise'].includes(planId)) {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
  }

  const plan = plans.find(p => p.id === planId);
  if (!plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 400 });

  const origin = req.headers.get('origin') || (new URL(req.url)).origin;
  const currency = plan.currency || 'LYD';

  const tx = await createTransaction({
    uid: authz.uid,
    planId,
    amount: plan.price,
    currency,
    provider,
    origin,
  });

  return NextResponse.json({ ok: true, id: tx.id, checkoutUrl: tx.checkoutUrl });
}
