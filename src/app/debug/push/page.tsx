'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { getAuth } from 'firebase/auth';

export default function PushDebugPage() {
  const [status, setStatus] = useState<string>('');
  const [swReady, setSwReady] = useState<boolean>(false);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [vapid, setVapid] = useState<string>('');

  const auth = useMemo(() => getAuth(), []);

  useEffect(() => {
    setVapid((process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '').toString());
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          setSwReady(true);
          const sub = await reg.pushManager.getSubscription();
          setSubscribed(!!sub);
        })
        .catch(() => setSwReady(false));
    }
  }, []);

  const sendTest = async () => {
    try {
      setStatus('Sending test...');
      const user = auth.currentUser;
      if (!user) { setStatus('Not signed in. Visit /login first.'); return; }
      const idToken = await user.getIdToken();
      const res = await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ title: 'Khidmaty', body: 'Test notification', url: '/dashboard' }),
      });
      const json = await res.json();
      setStatus(`Response: ${res.status} ${JSON.stringify(json)}`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'unknown'}`);
    }
  };

  const unsubscribe = async () => {
    try {
      setStatus('Unsubscribing...');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setStatus('No active push subscription.'); return; }
      await sub.unsubscribe();
      setSubscribed(false);
      setStatus('Unsubscribed push. Reload and re-enable notifications.');
    } catch (e: any) {
      setStatus(`Unsubscribe error: ${e?.message || 'unknown'}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container flex-1 py-6 md:py-10">
        <h1 className="mb-4 text-2xl font-bold">Push Debug</h1>
        <div className="mb-4 space-y-2 rounded border p-4 text-sm">
          <div><strong>Service worker ready:</strong> {swReady ? 'yes' : 'no'}</div>
          <div><strong>Subscribed:</strong> {subscribed ? 'yes' : 'no'}</div>
          <div><strong>VAPID set:</strong> {vapid ? `yes (${vapid.slice(0, 8)}…${vapid.slice(-6)})` : 'no'}</div>
          <div className="text-muted-foreground">Use the Notifications button in the header to opt-in if not subscribed.</div>
        </div>

        <div className="flex gap-2">
          <Button onClick={sendTest}>Send Test Push</Button>
          <Button variant="outline" onClick={unsubscribe}>Unsubscribe Push</Button>
        </div>

        {status && (
          <pre className="mt-4 whitespace-pre-wrap rounded bg-muted p-3 text-xs">{status}</pre>
        )}
      </main>
      <Footer />
    </div>
  );
}
