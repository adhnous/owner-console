"use client";

import { useState } from 'react';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [tips, setTips] = useState(false);

  return (
    <div className="ds-page">
      <div className="ds-container space-y-6">
        <div className="ds-hero">
          <div className="ds-hero-content">
            <h1 className="ds-title">Settings</h1>
            <p className="ds-subtitle">Manage preferences, theme, and notifications.</p>
          </div>
        </div>

        <div className="ds-grid-3">
          <section className="ds-card">
            <div className="ds-card-section">
              <h2 className="ds-section-title">Appearance</h2>
              <p className="ds-section-subtitle">Control theme and language.</p>
            </div>
            <div className="ds-card-section grid gap-4">
              <div className="grid gap-2">
                <label className="ds-label">Theme</label>
                <select className="ds-select" value={theme} onChange={(e) => setTheme(e.target.value as any)}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="ds-label">Language</label>
                <select className="ds-select" value={language} onChange={(e) => setLanguage(e.target.value as any)}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          </section>

          <section className="ds-card">
            <div className="ds-card-section">
              <h2 className="ds-section-title">Notifications</h2>
              <p className="ds-section-subtitle">Choose how you want to be notified.</p>
            </div>
            <div className="ds-card-section space-y-4">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <div className="ds-label">Email notifications</div>
                  <div className="text-sm text-muted-foreground">Updates about your services and account</div>
                </div>
                <input type="checkbox" className="h-5 w-5" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-4">
                <div>
                  <div className="ds-label">Push notifications</div>
                  <div className="text-sm text-muted-foreground">Real-time alerts on this device</div>
                </div>
                <input type="checkbox" className="h-5 w-5" checked={pushNotif} onChange={(e) => setPushNotif(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-4">
                <div>
                  <div className="ds-label">Tips & tutorials</div>
                  <div className="text-sm text-muted-foreground">Occasional product tips to help you succeed</div>
                </div>
                <input type="checkbox" className="h-5 w-5" checked={tips} onChange={(e) => setTips(e.target.checked)} />
              </label>
            </div>
          </section>

          <section className="ds-card">
            <div className="ds-card-section">
              <h2 className="ds-section-title">Account</h2>
              <p className="ds-section-subtitle">Security and privacy controls.</p>
            </div>
            <div className="ds-card-section space-y-4">
              <button className="ds-btn ds-btn-outline w-full">Change password</button>
              <button className="ds-btn ds-btn-danger w-full">Delete account</button>
            </div>
          </section>
        </div>

        <div className="ds-toolbar">
          <div className="text-sm text-muted-foreground">Your changes are saved automatically on this page.</div>
          <div className="flex gap-2">
            <button className="ds-btn ds-btn-outline">Reset</button>
            <button className="ds-btn ds-btn-primary">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
