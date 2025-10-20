"use client";

import { useEffect, useMemo, useState } from 'react';
import { getIdTokenOrThrow } from '@/lib/auth-client';

export default function ServiceDeletionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState<string>('pending');
  const [uid, setUid] = useState('');
  const [serviceId, setServiceId] = useState('');

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (uid) p.set('uid', uid.trim());
    if (serviceId) p.set('serviceId', serviceId.trim());
    p.set('limit', '300');
    return p.toString();
  }, [status, uid, serviceId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/service-deletions/list?${qs}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || 'load_failed');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, action: 'approve' | 'reject') {
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/service-deletions/decide', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, action }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
      alert(action === 'approve' ? 'Approved and service deleted.' : 'Rejected and service restored.');
    } catch (e: any) {
      alert(e?.message || 'update_failed');
    }
  }

  return (
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">Deletion Requests</h1>
      </div>

      <div className="oc-card" style={{ marginBottom: 12 }}>
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Filters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}>
          <div>
            <label className="oc-label">Status</label>
            <select className="oc-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">(any)</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="oc-label">UID</label>
            <input className="oc-input" value={uid} onChange={(e) => setUid(e.target.value)} />
          </div>
          <div>
            <label className="oc-label">Service ID</label>
            <input className="oc-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="oc-btn oc-btn-primary" onClick={load} disabled={loading}>Apply</button>
          </div>
        </div>
      </div>

      {error && (<div className="oc-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>)}

      <div className="oc-grid">
        {loading ? (
          <div className="oc-card">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="oc-card">No requests.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="oc-card oc-row">
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 className="oc-title" title={r.id}>{r.serviceTitle || r.serviceId}</h3>
                  <span className={`oc-badge ${r.status}`}>{r.status}</span>
                </div>
                <div className="oc-meta">
                  <span className="oc-subtle">Service: {r.serviceId}</span>
                  <span className="oc-subtle">UID: {r.uid}</span>
                  <span className="oc-subtle">Created: {r.createdAt || '-'}</span>
                  {r.approvedAt && <span className="oc-subtle">Decision: {r.approvedAt}</span>}
                </div>
                {r.reason && (
                  <div className="oc-meta" style={{ marginTop: 6 }}>
                    <span className="oc-subtle">Reason: {r.reason}</span>
                  </div>
                )}
              </div>
              <div className="oc-actions">
                {r.status === 'pending' && (
                  <>
                    <button className="oc-btn oc-btn-green" onClick={() => decide(r.id, 'approve')}>Approve & Delete</button>
                    <button className="oc-btn oc-btn-red" onClick={() => decide(r.id, 'reject')}>Reject</button>
                  </>
                )}
                <button className="oc-btn" onClick={() => {
                  try {
                    const origin = window.location.origin;
                    const mainOrigin = origin.includes(':3000') ? origin.replace(':3000', ':3001') : origin;
                    window.open(`${mainOrigin}/services/${r.serviceId}`, '_blank');
                  } catch {
                    window.open(`/services/${r.serviceId}`, '_blank');
                  }
                }}>View</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
