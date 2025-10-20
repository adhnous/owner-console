"use client";

import { useEffect, useState } from 'react';
import { getIdTokenOrThrow } from '@/lib/auth-client';

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getIdTokenOrThrow();
        const res = await fetch('/api/debug/whoami', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || res.statusText);
        setData(json);
      } catch (e: any) {
        setError(e?.message || 'Failed');
      }
    })();
  }, []);

  return (
    <div className="oc-container">
      <div className="oc-card">
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Debug WhoAmI</h3>
        {error && <div style={{ color: '#991b1b' }}>{error}</div>}
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
