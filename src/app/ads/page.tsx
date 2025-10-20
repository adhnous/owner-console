"use client";

import { useEffect, useState } from "react";
import { getIdTokenOrThrow } from "@/lib/auth-client";

 type Color = 'copper' | 'power' | 'dark' | 'light';
 type Row = {
  id: string;
  text: string;
  textAr: string;
  href: string;
  color: Color;
  active: boolean;
  priority: number;
  createdAt: string | null;
 };

 export default function AdsManagerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [fText, setFText] = useState("");
  const [fTextAr, setFTextAr] = useState("");
  const [fHref, setFHref] = useState("");
  const [fColor, setFColor] = useState<Color>('copper');
  const [fPriority, setFPriority] = useState<number>(0);
  const [fActive, setFActive] = useState<boolean>(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/ads/list', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createAd() {
    try {
      setCreating(true);
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/ads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: fText, textAr: fTextAr, href: fHref, color: fColor, priority: fPriority, active: fActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setFText(''); setFTextAr(''); setFHref(''); setFColor('copper'); setFPriority(0); setFActive(true);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function saveRow(r: Row) {
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/ads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: r.id, text: r.text, textAr: r.textAr, href: r.href, color: r.color, active: r.active, priority: r.priority }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this ad?')) return;
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/ads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    }
  }

  function setField(id: string, key: keyof Row, value: any) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="oc-grid">
      <div className="oc-toolbar">
        <h1 className="oc-h1">Ads Manager</h1>
      </div>

      {error && <div className="oc-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <div className="oc-card" style={{ marginBottom: 16 }}>
        <h3 className="oc-title" style={{ marginBottom: 8 }}>Create new ad</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="oc-label">Text (English)</label>
            <input className="oc-input" value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Advertise your service…" />
          </div>
          <div>
            <label className="oc-label">النص (عربي)</label>
            <input className="oc-input" value={fTextAr} onChange={(e) => setFTextAr(e.target.value)} placeholder="أعلن عن خدمتك…" />
          </div>
          <div>
            <label className="oc-label">Link (optional)</label>
            <input className="oc-input" value={fHref} onChange={(e) => setFHref(e.target.value)} placeholder="https://…" />
            <div className="oc-help" style={{ marginTop: 6 }}>Internal or external link opened when users click the ad.</div>
          </div>
          <div>
            <label className="oc-label">Color</label>
            <select className="oc-input" value={fColor} onChange={(e) => setFColor(e.target.value as Color)}>
              <option value="copper">Copper</option>
              <option value="power">Red</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label className="oc-label">Priority</label>
            <input type="number" className="oc-input" value={fPriority} onChange={(e) => setFPriority(Number(e.target.value)||0)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input id="ad-active" className="oc-switch" type="checkbox" checked={fActive} onChange={(e) => setFActive(e.target.checked)} />
            <label htmlFor="ad-active">Active</label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div className="oc-ad-badge">
            <span className="label">Ad</span>
            <span>{(fTextAr || fText) || 'Preview'}</span>
          </div>
          <button className="oc-btn oc-btn-primary" onClick={createAd} disabled={creating}>Create</button>
        </div>
      </div>

      {loading ? (
        <div className="oc-card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="oc-card">No ads.</div>
      ) : (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Text (EN)</th>
                <th style={{ minWidth: 220 }}>النص (AR)</th>
                <th style={{ minWidth: 180 }}>Link</th>
                <th style={{ width: 140 }}>Color</th>
                <th style={{ width: 120 }}>Priority</th>
                <th style={{ width: 100 }}>Active</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input className="oc-input" value={r.text} onChange={(e) => setField(r.id, 'text', e.target.value)} />
                    <div className="oc-help">ID: {r.id}</div>
                  </td>
                  <td>
                    <input className="oc-input" value={r.textAr} onChange={(e) => setField(r.id, 'textAr', e.target.value)} />
                  </td>
                  <td>
                    <input className="oc-input" value={r.href} onChange={(e) => setField(r.id, 'href', e.target.value)} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`oc-chip ${r.color}`}><span className="dot" />{r.color}</span>
                      <select className="oc-input" value={r.color} onChange={(e) => setField(r.id, 'color', e.target.value as Color)}>
                        <option value="copper">Copper</option>
                        <option value="power">Red</option>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </select>
                    </div>
                  </td>
                  <td>
                    <input type="number" className="oc-input" value={r.priority} onChange={(e) => setField(r.id, 'priority', Number(e.target.value)||0)} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input id={`active-${r.id}`} className="oc-switch" type="checkbox" checked={r.active} onChange={(e) => setField(r.id, 'active', e.target.checked)} />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="oc-btn oc-btn-primary" onClick={() => saveRow(r)}>Save</button>
                      <button className="oc-btn oc-btn-red" onClick={() => deleteRow(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
 }
