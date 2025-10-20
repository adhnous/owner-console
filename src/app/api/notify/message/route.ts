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
    const senderUid = decoded.uid as string;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const conversationId = String(body?.conversationId || '').trim();
    const text = String(body?.text || '').trim().slice(0, 140);
    if (!conversationId) {
      return NextResponse.json({ error: 'invalid_conversationId' }, { status: 400 });
    }

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });
    }
    const conv = convSnap.data() || {};
    const participants = (conv.participants || {}) as Record<string, boolean>;
    if (!participants[senderUid]) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const recipientUids = Object.keys(participants).filter((u) => u !== senderUid && participants[u]);
    if (!recipientUids.length) {
      return NextResponse.json({ ok: true, info: 'no_recipients' });
    }

    // Collect tokens from recipients
    const userDocs = await Promise.all(
      recipientUids.map((u) => db.collection('users').doc(u).get())
    );
    const tokens: string[] = [];
    for (const snap of userDocs) {
      if (!snap.exists) continue;
      const m = (snap.get('fcmTokens') || {}) as Record<string, boolean>;
      for (const k of Object.keys(m || {})) if (k) tokens.push(k);
    }

    if (!tokens.length) {
      return NextResponse.json({ ok: true, info: 'no_tokens' });
    }

    const url = `/messages/${conversationId}`;
    const res = await messaging.sendEachForMulticast({
      tokens,
      data: {
        title: 'New message',
        body: text || 'You have a new message',
        url,
      },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
