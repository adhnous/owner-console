"use client";

import { useEffect, useState } from "react";
import { getIdTokenOrThrow } from "@/lib/auth-client";

type Features = {
  pricingEnabled: boolean;
  showForProviders: boolean;
  showForSeekers: boolean;
  enforceAfterMonths: number;
  lockAllToPricing: boolean;
  lockProvidersToPricing: boolean;
  lockSeekersToPricing: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [pricingEnabled, setPricingEnabled] = useState<boolean>(true);
  const [showForProviders, setShowForProviders] = useState<boolean>(false);
  const [showForSeekers, setShowForSeekers] = useState<boolean>(false);
  const [enforceAfterMonths, setEnforceAfterMonths] = useState<number>(3);
  const [lockAllToPricing, setLockAllToPricing] = useState<boolean>(false);
  const [lockProvidersToPricing, setLockProvidersToPricing] = useState<boolean>(false);
  const [lockSeekersToPricing, setLockSeekersToPricing] = useState<boolean>(false);

  // ------- helpers -------
  const applyFeatures = (f: Partial<Features>) => {
    if (f.pricingEnabled !== undefined) setPricingEnabled(!!f.pricingEnabled);
    if (f.showForProviders !== undefined) setShowForProviders(!!f.showForProviders);
    if (f.showForSeekers !== undefined) setShowForSeekers(!!f.showForSeekers);
    if (f.enforceAfterMonths !== undefined)
      setEnforceAfterMonths(Number.isFinite(f.enforceAfterMonths) ? Number(f.enforceAfterMonths) : 3);
    if (f.lockAllToPricing !== undefined) setLockAllToPricing(!!f.lockAllToPricing);
    if (f.lockProvidersToPricing !== undefined) setLockProvidersToPricing(!!f.lockProvidersToPricing);
    if (f.lockSeekersToPricing !== undefined) setLockSeekersToPricing(!!f.lockSeekersToPricing);
  };

  async function load() {
    setLoading(true); setError(null); setOkMsg(null);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/settings/features', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      applyFeatures(json.features || {});
    } catch (e: any) {
      const msg = e?.message || 'Failed to load settings';
      setError(msg);
      // Optional: if unauthorized, redirect to login
      // if (/unauthorized|forbidden|401|403/i.test(msg)) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true); setError(null); setOkMsg(null);
    try {
      const token = await getIdTokenOrThrow();
      const body: Features = {
        pricingEnabled,
        showForProviders,
        showForSeekers,
        enforceAfterMonths,
        lockAllToPricing,
        lockProvidersToPricing,
        lockSeekersToPricing,
      };
      const res = await fetch('/api/settings/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setOkMsg('Settings saved successfully.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // cascade: lockAll → lock providers & seekers
  const onToggleLockAll = (checked: boolean) => {
    setLockAllToPricing(checked);
    if (checked) {
      setLockProvidersToPricing(true);
      setLockSeekersToPricing(true);
    }
  };

  useEffect(() => { load(); }, []);

  const disabled = saving || !pricingEnabled;

  // ------- UI -------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Feature Settings</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Configure pricing features and access controls for your platform
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-red-100 rounded-full grid place-items-center">
                <svg className="w-5 h-5 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
              </span>
              <div>
                <h3 className="text-base font-semibold text-red-800">There was a problem</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
        {okMsg && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
            {okMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-8">
              <nav className="space-y-2">
                <button className="w-full flex items-center px-4 py-3 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl border border-blue-100">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Pricing Features
                </button>
              </nav>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl shadow-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="lg:col-span-2 space-y-8">
            {/* Master Toggle */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Pricing Features</h2>
                    <p className="text-gray-600 text-lg">Enable or disable pricing functionality across your platform</p>
                  </div>
                  <div className="flex-shrink-0 ml-6">
                    <button
                      onClick={() => setPricingEnabled(!pricingEnabled)}
                      aria-pressed={pricingEnabled}
                      className={`relative inline-flex h-8 w-14 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${pricingEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition ${pricingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-green-50 rounded-xl grid place-items-center mr-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Immediate Visibility</h3>
                    <p className="text-gray-600 text-sm">Show pricing right after registration</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <RowCheckbox
                    label="For Providers"
                    help="Show pricing to service providers immediately"
                    checked={showForProviders}
                    onChange={setShowForProviders}
                    disabled={disabled}
                  />
                  <RowCheckbox
                    label="For Seekers"
                    help="Show pricing to service seekers immediately"
                    checked={showForSeekers}
                    onChange={setShowForSeekers}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Access Control */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl grid place-items-center mr-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Access Control</h3>
                    <p className="text-gray-600 text-sm">Restrict access based on pricing plans</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <RowCheckbox
                    label="Lock Entire App"
                    help="Everyone uses the free plan with limitations"
                    checked={lockAllToPricing}
                    onChange={onToggleLockAll}
                    disabled={saving || !pricingEnabled}
                  />
                  <RowCheckbox
                    label="Lock Providers"
                    help="Restrict provider access on free plan"
                    checked={lockProvidersToPricing}
                    onChange={setLockProvidersToPricing}
                    disabled={saving || !pricingEnabled || lockAllToPricing}
                  />
                  <RowCheckbox
                    label="Lock Seekers"
                    help="Restrict seeker access on free plan"
                    checked={lockSeekersToPricing}
                    onChange={setLockSeekersToPricing}
                    disabled={saving || !pricingEnabled || lockAllToPricing}
                  />
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl grid place-items-center mr-4">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Timing Configuration</h3>
                  <p className="text-gray-600 text-sm">When pricing becomes visible</p>
                </div>
              </div>

              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-900 mb-4">
                  Show pricing after (months)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={enforceAfterMonths}
                    onChange={(e) => setEnforceAfterMonths(Number(e.target.value))}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="w-20">
                    <input
                      type="number"
                      min={0}
                      value={enforceAfterMonths}
                      onChange={(e) => setEnforceAfterMonths(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      disabled={disabled}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-medium text-gray-900 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  {enforceAfterMonths === 0
                    ? "Pricing will be visible to all users immediately after registration."
                    : `Pricing becomes visible ${enforceAfterMonths} month${enforceAfterMonths === 1 ? '' : 's'} after registration.`}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Small presentational checkbox row */
function RowCheckbox({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
      <div className="pr-4">
        <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
        {help && <p className="text-xs text-gray-500">{help}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={label}
      />
    </div>
  );
}
