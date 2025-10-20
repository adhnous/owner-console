import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'missing_token' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    const { auth, db, messaging } = await getAdmin();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid as string;

    const snap = await db.collection('users').doc(uid).get();
    const tokensMap = snap.exists ? (snap.get('fcmTokens') || {}) : {};
    const tokens = Object.keys(tokensMap || {}).filter(Boolean);

    if (!tokens.length) {
      return NextResponse.json({ ok: false, error: 'no_tokens' }, { status: 400 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const title = body?.title ?? 'Khidmaty';
    const messageBody = body?.body ?? 'Test notification';
    const url = body?.url ?? '/';

    const res = await messaging.sendEachForMulticast({
      tokens,
      data: {
        title: String(title),
        body: String(messageBody),
        url: String(url),
      },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
