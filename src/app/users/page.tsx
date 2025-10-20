"use client";

import { useState } from "react";
import { getIdTokenOrThrow } from "@/lib/auth-client";

export default function UsersOverridesPage() {
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  const [mode, setMode] = useState<"" | "force_show" | "force_hide">("");
  const [showAt, setShowAt] = useState<string>("");
  const [enforceAfterMonths, setEnforceAfterMonths] = useState<number | "">("");
  const [status, setStatus] = useState<'active' | 'disabled'>('active');

  async function search() {
    setLoading(true); setError(null); setUser(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/users/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email || undefined, uid: uid || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setUser(json.user);
      const pg = json.user?.pricingGate || {};
      setMode(pg?.mode || "");
      const showAtISO = pg?.showAt?._seconds ? new Date(pg.showAt._seconds * 1000).toISOString().slice(0,16) : (pg?.showAt ? new Date(pg.showAt).toISOString().slice(0,16) : "");
      setShowAt(showAtISO);
      setEnforceAfterMonths(pg?.enforceAfterMonths ?? "");
      setStatus(json.user?.status === 'disabled' ? 'disabled' : 'active');
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(next: 'active' | 'disabled') {
    if (!user?.uid) return;
    setSaving(true); setError(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/users/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: user.uid, status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setStatus(json.status === 'disabled' ? 'disabled' : 'active');
      alert('Status updated');
    } catch (e: any) {
      setError(e?.message || 'Update status failed');
    } finally {
      setSaving(false);
    }
  }
  

  async function save() {
    if (!user?.uid) return;
    setSaving(true); setError(null);
    try {
      const token = await getIdTokenOrThrow();
      const payload: any = { uid: user.uid };
      if (mode) payload.mode = mode; else payload.mode = null;
      if (showAt) payload.showAt = new Date(showAt).toISOString(); else payload.showAt = null;
      if (enforceAfterMonths !== "") payload.enforceAfterMonths = enforceAfterMonths;
      const res = await fetch('/api/users/set-pricing-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      alert('Saved');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">Users</h1>
      </div>

      {error && (
        <div className="oc-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>
      )}

      <div className="oc-card">
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Find user</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
          <div>
            <label className="oc-label">Email</label>
            <input className="oc-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <label className="oc-label">UID</label>
            <input className="oc-input" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="firebase uid" />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="oc-btn oc-btn-primary" onClick={search} disabled={loading}>Search</button>
          </div>
        </div>
      </div>

      {user && (
        <div className="oc-card">
          <h3 className="oc-title" style={{ marginBottom: 8 }}>User</h3>
          <div className="oc-kv">
            <div><span className="k">UID</span><span className="v">{user.uid}</span></div>
            <div><span className="k">Email</span><span className="v">{user.email || '-'}</span></div>
            <div><span className="k">Role</span><span className="v">{user.role || '-'}</span></div>
            <div><span className="k">Plan</span><span className="v">{user.plan || '-'}</span></div>
            <div><span className="k">Status</span><span className="v">{status}</span></div>
            <div><span className="k">Created</span><span className="v">{user.createdAt || '-'}</span></div>
          </div>

          <div style={{ margin: '10px 0 18px' }}>
            {status === 'active' ? (
              <button className="oc-btn" onClick={() => toggleStatus('disabled')} disabled={saving}>Disable account</button>
            ) : (
              <button className="oc-btn oc-btn-primary" onClick={() => toggleStatus('active')} disabled={saving}>Enable account</button>
            )}
          </div>

          <h4 className="oc-title" style={{ margin: '12px 0 8px' }}>Pricing Overrides</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}>
            <div>
              <label className="oc-label">Mode</label>
              <select className="oc-input" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="">(default rules)</option>
                <option value="force_show">Force Show</option>
                <option value="force_hide">Force Hide</option>
              </select>
            </div>
            <div>
              <label className="oc-label">Show at (optional)</label>
              <input className="oc-input" type="datetime-local" value={showAt} onChange={(e) => setShowAt(e.target.value)} />
              <div className="oc-help">When reached, Pricing becomes visible for this user.</div>
            </div>
            <div>
              <label className="oc-label">Enforce after months (optional)</label>
              <input className="oc-input" type="number" min={0} value={enforceAfterMonths} onChange={(e) => setEnforceAfterMonths(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value)||0)))} />
              <div className="oc-help">Overrides the global months for this user.</div>
            </div>
            <div style={{ alignSelf: 'end' }}>
              <button className="oc-btn oc-btn-primary" onClick={save} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
