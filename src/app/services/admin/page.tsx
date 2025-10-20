"use client";

import { useEffect, useMemo, useState } from 'react';
import { getIdTokenOrThrow } from '@/lib/auth-client';

// Simple types for the grid
type Row = {
  id: string;
  title: string;
  providerId: string;
  providerName?: string | null;
  status: 'pending' | 'approved' | 'rejected' | null;
  createdAt: string | null;
  imageUrl?: string | null;
  price?: number | null;
  category?: string | null;
  city?: string | null;
  area?: string | null;
};

type Status = '' | 'pending' | 'approved' | 'rejected';

export default function AdminServicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [providerUid, setProviderUid] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [q, setQ] = useState('');

  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  // Create form state
  const [cProviderUid, setCProviderUid] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cPrice, setCPrice] = useState<string>('');
  const [cCategory, setCCategory] = useState('');
  const [cCity, setCCity] = useState('');
  const [cArea, setCArea] = useState('');
  const [cStatus, setCStatus] = useState<'pending'|'approved'|'rejected'>('pending');
  const [cPhone, setCPhone] = useState('');
  const [cWhatsapp, setCWhatsapp] = useState('');
  const [cImageUrl, setCImageUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (providerUid) p.set('providerUid', providerUid.trim());
    if (email) p.set('email', email.trim());
    if (status) p.set('status', status);
    if (q) p.set('q', q.trim());
    p.set('limit', '300');
    return p.toString();
  }, [providerUid, email, status, q]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/services/admin/list?${queryString}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  async function bulkRemove() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) { alert('Select at least one'); return; }
    if (!confirm(`Delete ${ids.length} services? This cannot be undone.`)) return;
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/services/admin/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(prev => prev.filter(r => !ids.includes(r.id)));
      setSelected({});
      alert(`Deleted ${json.deleted}`);
    } catch (e: any) {
      alert(e?.message || 'Bulk delete failed');
    }
  }

  useEffect(() => { load(); }, []);

  async function applyUpdate(id: string, partial: Record<string, any>) {
    setSavingId(id);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/services/admin/update', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, ...partial }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete service? This cannot be undone.')) return;
    setSavingId(id);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/services/admin/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setSavingId(null);
    }
  }

  function fmtPrice(n?: number | null) {
    if (typeof n !== 'number') return null;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 }).format(n); } catch { return `${n} LYD`; }
  }

  return (
    <>
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">All Services (Admin)</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <label className="oc-subtle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox"
              checked={rows.length > 0 && rows.every(r => selected[r.id])}
              onChange={(e) => {
                const all = e.target.checked;
                const next: Record<string, boolean> = {};
                if (all) for (const r of rows) next[r.id] = true;
                setSelected(next);
              }}
            />
            Select all
          </label>
          <div className="oc-subtle">Selected: {selectedCount}</div>
          <button className="oc-btn oc-btn-red" onClick={bulkRemove} disabled={selectedCount === 0}>Bulk Delete</button>
        </div>
      </div>

      {/* Create new service */}
      <div className="oc-card" style={{ marginBottom: 12 }}>
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Create Service</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="oc-label">Provider UID</label>
            <input className="oc-input" value={cProviderUid} onChange={(e) => setCProviderUid(e.target.value)} placeholder="uid (or use email)" />
          </div>
          <div>
            <label className="oc-label">Provider Email</label>
            <input className="oc-input" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <label className="oc-label">Title</label>
            <input className="oc-input" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Service title" />
          </div>
          <div>
            <label className="oc-label">Price</label>
            <input className="oc-input" type="number" value={cPrice} onChange={(e) => setCPrice(e.target.value)} placeholder="150" />
          </div>
          <div>
            <label className="oc-label">Status</label>
            <select className="oc-input" value={cStatus} onChange={(e) => setCStatus(e.target.value as any)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 2fr auto', gap: 12, marginTop: 10 }}>
          <div>
            <label className="oc-label">Category</label>
            <input className="oc-input" value={cCategory} onChange={(e) => setCCategory(e.target.value)} placeholder="Plumbing" />
          </div>
          <div>
            <label className="oc-label">City</label>
            <input className="oc-input" value={cCity} onChange={(e) => setCCity(e.target.value)} placeholder="Tripoli" />
          </div>
          <div>
            <label className="oc-label">Area</label>
            <input className="oc-input" value={cArea} onChange={(e) => setCArea(e.target.value)} placeholder="Hay Al-Andalus" />
          </div>
          <div>
            <label className="oc-label">Phone</label>
            <input className="oc-input" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+2189..." />
          </div>
          <div>
            <label className="oc-label">WhatsApp</label>
            <input className="oc-input" value={cWhatsapp} onChange={(e) => setCWhatsapp(e.target.value)} placeholder="+2189..." />
          </div>
          <div>
            <label className="oc-label">Image URL (optional)</label>
            <input className="oc-input" value={cImageUrl} onChange={(e) => setCImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="oc-btn oc-btn-primary" disabled={creating} onClick={async () => {
              if (!cProviderUid && !cEmail) { alert('Enter provider UID or Email'); return; }
              if (!cTitle.trim()) { alert('Enter title'); return; }
              setCreating(true);
              try {
                const token = await getIdTokenOrThrow();
                const payload: any = { providerUid: cProviderUid || undefined, email: cEmail || undefined, title: cTitle.trim(), status: cStatus };
                if (cPrice !== '') payload.price = Number(cPrice);
                if (cCategory) payload.category = cCategory;
                if (cCity) payload.city = cCity;
                if (cArea) payload.area = cArea;
                if (cPhone) payload.contactPhone = cPhone;
                if (cWhatsapp) payload.contactWhatsapp = cWhatsapp;
                if (cImageUrl) payload.imageUrl = cImageUrl;
                const res = await fetch('/api/services/admin/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || res.statusText);
                // reset a few
                setCTitle(''); setCPrice(''); setCImageUrl('');
                await load();
                alert('Created');
              } catch (e: any) {
                alert(e?.message || 'Create failed');
              } finally {
                setCreating(false);
              }
            }}>Create</button>
          </div>
        </div>
      </div>

      <div className="oc-card" style={{ marginBottom: 12 }}>
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Filters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12 }}>
          <div>
            <label className="oc-label">Provider UID</label>
            <input className="oc-input" value={providerUid} onChange={(e) => setProviderUid(e.target.value)} placeholder="uid" />
          </div>
          <div>
            <label className="oc-label">Email</label>
            <input className="oc-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <label className="oc-label">Status</label>
            <select className="oc-input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="">(any)</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="oc-label">Search in title</label>
            <input className="oc-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="text..." />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="oc-btn oc-btn-primary" onClick={load} disabled={loading}>Apply</button>
          </div>
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
              <img className="oc-thumb" alt={r.title || r.id} src={r.imageUrl || 'https://placehold.co/240x180?text=No+Image'} loading="lazy" />
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 className="oc-title" title={r.title}>{r.title || r.id}</h3>
                  <span className={`oc-badge ${r.status ?? 'pending'}`}>{r.status}</span>
                </div>
                <div className="oc-meta">
                  {r.category && <span>{r.category}</span>}
                  {typeof r.price === 'number' && <span>{fmtPrice(r.price)}</span>}
                  {(r.city || r.area) && <span>{[r.area, r.city].filter(Boolean).join(', ')}</span>}
                </div>
                <div className="oc-meta" style={{ marginTop: 6 }}>
                  <span className="oc-subtle">Provider: {r.providerName || r.providerId}</span>
                  <span className="oc-subtle">Created: {r.createdAt || '-'}</span>
                </div>

                {/* Quick edit controls */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 140px 140px 140px auto', gap: 8, marginTop: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={!!selected[r.id]} onChange={(e) => setSelected(prev => ({ ...prev, [r.id]: e.target.checked }))} />
                    <span className="oc-subtle">Select</span>
                  </label>
                  <input className="oc-input" defaultValue={r.title} onBlur={(e) => (e.target.value !== r.title) && applyUpdate(r.id, { title: e.target.value })} />
                  <input className="oc-input" defaultValue={r.price ?? ''} type="number" onBlur={(e) => applyUpdate(r.id, { price: Number(e.target.value||'0') })} />
                  <input className="oc-input" defaultValue={r.category ?? ''} onBlur={(e) => applyUpdate(r.id, { category: e.target.value })} />
                  <input className="oc-input" defaultValue={r.city ?? ''} onBlur={(e) => applyUpdate(r.id, { city: e.target.value })} />
                  <input className="oc-input" defaultValue={r.area ?? ''} onBlur={(e) => applyUpdate(r.id, { area: e.target.value })} />
                  <select className="oc-input" defaultValue={r.status ?? ''} onChange={(e) => applyUpdate(r.id, { status: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="oc-btn"
                      onClick={() => {
                        try {
                          const origin = window.location.origin;
                          const mainOrigin = origin.includes(':3000') ? origin.replace(':3000', ':3001') : origin;
                          window.open(`${mainOrigin}/services/${r.id}`, '_blank');
                        } catch {
                          window.open(`/services/${r.id}`, '_blank');
                        }
                      }}
                    >
                      View
                    </button>
                    <button className="oc-btn oc-btn-red" onClick={() => remove(r.id)} disabled={savingId === r.id}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    {selectedCount > 0 && (
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '10px 12px', background: 'rgba(17,17,17,0.85)', backdropFilter: 'blur(6px)', borderTop: '1px solid #333', zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="oc-subtle">{selectedCount} selected</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="oc-btn" onClick={() => setSelected({})}>Clear</button>
            <button className="oc-btn oc-btn-red" onClick={bulkRemove}>Delete selected</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
