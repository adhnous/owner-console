import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    const { db, FieldValue } = await getAdmin();
    const ref = db.collection('contact_messages').doc();
    await ref.set({
      name: String(name),
      email: String(email),
      message: String(message),
      createdAt: FieldValue.serverTimestamp(),
      status: 'new',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
