"use client";

import { useEffect, useState } from "react";
import { getIdTokenOrThrow } from "@/lib/auth-client";

export default function TransactionsPage() {
  const [tab, setTab] = useState<'pending'|'success'>('pending');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/transactions/list?status=${tab}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function confirm(id: string) {
    setConfirming(id);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Confirm failed');
    } finally {
      setConfirming(null);
    }
  }

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">Transactions</h1>
        <div className="oc-tabs">
          <button className={`oc-tab ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}>Pending</button>
          <button className={`oc-tab ${tab==='success'?'active':''}`} onClick={() => setTab('success')}>Success</button>
        </div>
      </div>

      {error && (
        <div className="oc-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>
      )}

      <div className="oc-card">
        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No transactions.</div>
        ) : (
          <div className="oc-list">
            {rows.map((r: any) => (
              <div key={r.id} className="oc-list-item">
                <div className="oc-list-left">
                  <div className="oc-title">{r.userName || r.uid}</div>
                  <div className="oc-sub">{r.planId?.toUpperCase()} • {r.amount} {r.currency} • {new Date(r.createdAt||'').toLocaleString()}</div>
                </div>
                <div className="oc-list-right">
                  {tab === 'pending' ? (
                    <button className="oc-btn oc-btn-primary" onClick={() => confirm(r.id)} disabled={!!confirming && confirming===r.id}>Mark Paid</button>
                  ) : (
                    <span className="oc-badge oc-badge-success">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
