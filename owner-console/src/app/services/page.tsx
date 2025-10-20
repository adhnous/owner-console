"use client";

import { useEffect, useState } from 'react';
import { getIdTokenOrThrow } from '@/lib/auth-client';
 
// In your services/page.tsx, temporarily add:
//import AuthDebug from '@/components/auth-debug';

// In the return section, add:
//<AuthDebug />
type Row = {
  id: string;
  title: string;
  providerId: string;
  providerName?: string | null;
  status: 'pending' | 'approved' | 'rejected' | null;
  createdAt: string | null;
  imageUrl?: string | null;
  images?: { url: string }[];
  price?: number | null;
  category?: string | null;
  city?: string | null;
  area?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  description?: string | null;
  videoUrl?: string | null;
};

type Status = 'pending' | 'approved' | 'rejected';

export default function ServicesModerationPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/services/list?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function update(id: string, next: Status) {
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/services/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to update');
    }
  }

  function fmtPrice(n?: number | null) {
    if (typeof n !== 'number') return null;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 }).format(n); } catch { return `${n} LYD`; }
  }

  function badgeClass(s: Row['status']) {
    return `oc-badge ${s ?? 'pending'}`;
  }

  return (
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">Services Moderation</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="oc-select" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && <div className="oc-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <div className="oc-grid">
        {loading ? (
          <div className="oc-card">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="oc-card">No services.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="oc-card oc-row">
              <img
                className="oc-thumb"
                alt={r.title || r.id}
                src={r.imageUrl || 'https://placehold.co/240x180?text=No+Image'}
                loading="lazy"
              />
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 className="oc-title" title={r.title}>{r.title || r.id}</h3>
                  <span className={badgeClass(r.status)}>{r.status}</span>
                </div>
                <div className="oc-meta">
                  {r.category && <span>{r.category}</span>}
                  {typeof r.price === 'number' && <span>{fmtPrice(r.price)}</span>}
                  {(r.city || r.area) && <span>{[r.area, r.city].filter(Boolean).join(', ')}</span>}
                </div>
                {r.description && (
                  <p className="oc-desc" title={r.description}>
                    {r.description.length > 160 ? `${r.description.slice(0, 160)}…` : r.description}
                  </p>
                )}
                {(r.images && r.images.length > 1) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {r.images.slice(1, 5).map((im, i) => (
                      <img key={i} src={im.url} alt={`img-${i}`} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    ))}
                  </div>
                )}
                {r.videoUrl && (
                  <div className="oc-meta" style={{ marginTop: 6 }}>
                    <a href={r.videoUrl} target="_blank" rel="noreferrer" className="oc-subtle" style={{ textDecoration: 'underline' }}>Video</a>
                  </div>
                )}
                <div className="oc-meta" style={{ marginTop: 6 }}>
                  <span className="oc-subtle">Provider: {r.providerName || r.providerId}</span>
                  <span className="oc-subtle">Created: {r.createdAt || '-'}</span>
                  {(r.contactPhone || r.contactWhatsapp) && (
                    <span className="oc-subtle">Contact: {[r.contactPhone, r.contactWhatsapp].filter(Boolean).join(' / ')}</span>
                  )}
                </div>
              </div>
              <div className="oc-actions">
                {status !== 'approved' && (
                  <button className="oc-btn oc-btn-green" onClick={() => update(r.id, 'approved')}>Approve</button>
                )}
                {status !== 'rejected' && (
                  <button className="oc-btn oc-btn-red" onClick={() => update(r.id, 'rejected')}>Reject</button>
                )}
                {status !== 'pending' && (
                  <button className="oc-btn" onClick={() => update(r.id, 'pending')}>Mark Pending</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
