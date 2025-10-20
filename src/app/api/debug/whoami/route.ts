import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { auth, db } = await getAdmin();
  const appMod: any = await import('firebase-admin/app');
  const apps = appMod.getApps?.() || [];
  const app = apps[0];
  const adminProjectId = app?.options?.projectId || null;
  const envProjectId = process.env.FIREBASE_PROJECT_ID || null;

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;

  let decoded: any = null;
  let verifyError: string | null = null;
  if (token) {
    try {
      decoded = await auth.verifyIdToken(token);
    } catch (e: any) {
      verifyError = String(e?.errorInfo?.code || e?.message || e);
    }
  } else {
    verifyError = 'no_token_provided';
  }

  return NextResponse.json({
    adminProjectId,
    envProjectId,
    decodedUid: decoded?.uid || null,
    decodedIssuer: decoded?.iss || null,
    tokenIssuedAt: decoded?.iat || null,
    tokenAuthTime: decoded?.auth_time || null,
    verifyError,
  });
}
