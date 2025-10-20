import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const { db } = await getAdmin();
  const snap = await db.collection('ads').limit(200).get();
  const rows = snap.docs.map((d: any) => {
    const data = d.data() || {};
    const createdAtISO = data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : null;
    return {
      id: d.id,
      text: data.text || '',
      textAr: data.textAr || '',
      href: data.href || '',
      color: data.color || 'copper',
      active: !!data.active,
      priority: typeof data.priority === 'number' ? data.priority : 0,
      createdAt: createdAtISO,
    } as const;
  });

  // Sort by priority desc then createdAt desc
  rows.sort((a: any, b: any) => (b.priority - a.priority) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return NextResponse.json({ rows });
}
