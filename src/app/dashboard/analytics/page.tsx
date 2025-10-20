"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { listProviderDailyStats, type StatsDaily } from '@/lib/analytics';
import { listServicesByProvider, type Service } from '@/lib/services';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Link from 'next/link';

type Row = { day: string; views: number; ctas: number; messages: number };

function lastNDaysLabels(n: number): string[] {
  const arr: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const td = new Date(d);
    td.setDate(d.getDate() - i);
    arr.push(td.toISOString().slice(5, 10)); // MM-DD
  }
  return arr;
}

export default function AnalyticsPage() {
  const { user, userProfile } = useAuth();
  const [rowsAll, setRowsAll] = useState<StatsDaily[]>([]);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const days = 30;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch 60d so we can compare last 30d vs previous 30d
        const out = await listProviderDailyStats(user.uid, days * 2);
        if (mounted) setRowsAll(out);
        const svc = await listServicesByProvider(user.uid, 200);
        if (mounted) setServices(svc);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  // Helper: yyyymmdd for N days ago
  function yyyymmddDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  const rows = useMemo(() => {
    const since = yyyymmddDaysAgo(days);
    return rowsAll.filter((r) => (r.yyyymmdd || '') >= since);
  }, [rowsAll]);

  const prevRows = useMemo(() => {
    const since60 = yyyymmddDaysAgo(days * 2);
    const since30 = yyyymmddDaysAgo(days);
    return rowsAll.filter((r) => (r.yyyymmdd || '') >= since60 && (r.yyyymmdd || '') < since30);
  }, [rowsAll]);

  const chartData: Row[] = useMemo(() => {
    const byDay = new Map<string, Row>();
    const labels = lastNDaysLabels(days);
    for (const label of labels) byDay.set(label, { day: label, views: 0, ctas: 0, messages: 0 });
    for (const r of rows) {
      if (!r.yyyymmdd) continue;
      const label = `${r.yyyymmdd.slice(4, 6)}-${r.yyyymmdd.slice(6, 8)}`; // MM-DD
      const prev = byDay.get(label) || { day: label, views: 0, ctas: 0, messages: 0 };
      byDay.set(label, {
        day: label,
        views: (prev.views || 0) + (r.views || 0),
        ctas: (prev.ctas || 0) + (r.ctas || 0),
        messages: (prev.messages || 0) + (r.messages || 0),
      });
    }
    return Array.from(byDay.values());
  }, [rows]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, r) => ({
        views: acc.views + (r.views || 0),
        ctas: acc.ctas + (r.ctas || 0),
        messages: acc.messages + (r.messages || 0),
      }),
      { views: 0, ctas: 0, messages: 0 }
    );
  }, [chartData]);

  const ctr = useMemo(() => (totals.views > 0 ? totals.ctas / totals.views : 0), [totals]);
  const msgRate = useMemo(() => (totals.views > 0 ? totals.messages / totals.views : 0), [totals]);

  const totalsPrev = useMemo(() => {
    return prevRows.reduce(
      (acc, r) => ({
        views: acc.views + (r.views || 0),
        ctas: acc.ctas + (r.ctas || 0),
        messages: acc.messages + (r.messages || 0),
      }),
      { views: 0, ctas: 0, messages: 0 }
    );
  }, [prevRows]);

  const ctrPrev = useMemo(() => (totalsPrev.views > 0 ? totalsPrev.ctas / totalsPrev.views : 0), [totalsPrev]);
  const msgRatePrev = useMemo(() => (totalsPrev.views > 0 ? totalsPrev.messages / totalsPrev.views : 0), [totalsPrev]);

  function pctDelta(curr: number, prev: number): string {
    if (!isFinite(prev) || prev <= 0) return '—';
    const d = ((curr - prev) / prev) * 100;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(0)}% vs prev 30d`;
  }

  // Group stats by service for per-service performance
  const byService = useMemo(() => {
    const m = new Map<string, { views: number; ctas: number; messages: number }>();
    for (const r of rows) {
      const k = r.serviceId || 'unknown';
      const prev = m.get(k) || { views: 0, ctas: 0, messages: 0 };
      m.set(k, { views: prev.views + (r.views || 0), ctas: prev.ctas + (r.ctas || 0), messages: prev.messages + (r.messages || 0) });
    }
    return m;
  }, [rows]);

  const servicePerf = useMemo(() => {
    return services.map((s) => {
      const st = byService.get(s.id || '') || { views: 0, ctas: 0, messages: 0 };
      const ctr = st.views > 0 ? st.ctas / st.views : 0;
      const msgRate = st.views > 0 ? st.messages / st.views : 0;
      return { id: s.id!, title: s.title, status: s.status, views: st.views, ctas: st.ctas, messages: st.messages, ctr, msgRate };
    }).sort((a, b) => b.views - a.views);
  }, [services, byService]);

  // Generate suggestions based on content and performance
  const suggestions = useMemo(() => {
    const out: { text: string; href?: string }[] = [];
    // Global KPIs
    if (totals.views >= 50 && ctr < 0.03) {
      out.push({ text: 'Low contact CTR. Improve cover image and title on your most-viewed service.', href: topEditHref(servicePerf) });
    }
    if (totals.views >= 50 && msgRate < 0.01) {
      out.push({ text: 'Few messages vs. views. Add WhatsApp/phone or clearer CTA in description.', href: topEditHref(servicePerf) });
    }
    // Content checks per service
    for (const s of services) {
      const href = s.id ? `/dashboard/services/${s.id}/edit` : undefined;
      const imgs = Array.isArray(s.images) ? s.images : [];
      if (imgs.length === 0) out.push({ text: `Add images to "${s.title}" (listings with images perform better).`, href });
      if (!s.videoUrl && !(s.videoUrls && s.videoUrls.length)) {
        const st = byService.get(s.id || '') || { views: 0 } as any;
        if ((st.views || 0) > 30) out.push({ text: `Consider adding a short video to "${s.title}".`, href });
      }
      if (!s.contactPhone && !s.contactWhatsapp) out.push({ text: `Add a contact method for "${s.title}" (phone or WhatsApp).`, href });
      if (!s.lat || !s.lng) out.push({ text: `Set a precise map location for "${s.title}" to increase trust.`, href });
      if ((s.price ?? 0) <= 0) out.push({ text: `Set a clear price for "${s.title}" (0 can reduce conversions).`, href });
      if (!s.priority && !s.featured) out.push({ text: `Boost visibility of "${s.title}" with priority or featuring (when available).`, href });
    }
    // De-duplicate by text
    const seen = new Set<string>();
    return out.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true))).slice(0, 10);
  }, [services, totals, ctr, msgRate, byService, servicePerf]);

  function topEditHref(perf: { id: string; views: number }[]) {
    const top = perf.find((p) => p.views > 0);
    return top ? `/dashboard/services/${top.id}/edit` : undefined;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Sign in to view your analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="underline" href="/login">Go to Login</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription>Total Views (30d)</CardDescription>
            <CardTitle className="text-3xl">{totals.views.toLocaleString()}</CardTitle>
            <div className="text-xs text-muted-foreground">{pctDelta(totals.views, totalsPrev.views)}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Contact Clicks (30d)</CardDescription>
            <CardTitle className="text-3xl">{totals.ctas.toLocaleString()}</CardTitle>
            <div className="text-xs text-muted-foreground">{pctDelta(totals.ctas, totalsPrev.ctas)}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Messages (30d)</CardDescription>
            <CardTitle className="text-3xl">{totals.messages.toLocaleString()}</CardTitle>
            <div className="text-xs text-muted-foreground">{pctDelta(totals.messages, totalsPrev.messages)}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>CTR (CTAs / Views)</CardDescription>
            <CardTitle className="text-3xl">{(ctr * 100).toFixed(1)}%</CardTitle>
            <div className="text-xs text-muted-foreground">{pctDelta(ctr, ctrPrev)}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Message Rate (Msgs / Views)</CardDescription>
            <CardTitle className="text-3xl">{(msgRate * 100).toFixed(1)}%</CardTitle>
            <div className="text-xs text-muted-foreground">{pctDelta(msgRate, msgRatePrev)}</div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last {days} days</CardTitle>
          <CardDescription>
            Views, contact clicks, and messages for all your services.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" name="Views" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="ctas" stroke="#16a34a" name="CTAs" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="messages" stroke="#f59e0b" name="Messages" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-service performance (30d)</CardTitle>
          <CardDescription>Views, contact clicks, messages, and conversion rates.</CardDescription>
        </CardHeader>
        <CardContent>
          {servicePerf.length === 0 ? (
            <div className="text-sm text-muted-foreground">No services yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3">CTAs</th>
                    <th className="py-2 pr-3">Messages</th>
                    <th className="py-2 pr-3">CTR</th>
                    <th className="py-2 pr-3">Msg Rate</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {servicePerf.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 max-w-[340px] truncate">{r.title}</td>
                      <td className="py-2 pr-3">{r.views}</td>
                      <td className="py-2 pr-3">{r.ctas}</td>
                      <td className="py-2 pr-3">{r.messages}</td>
                      <td className="py-2 pr-3">{(r.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-3">{(r.msgRate * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-3">
                        <Link className="underline" href={`/dashboard/services/${r.id}/edit`}>Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggestions</CardTitle>
          <CardDescription>Personalized tips to improve visibility and conversions.</CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="text-sm text-muted-foreground">All good! Keep posting and updating your services.</div>
          ) : (
            <ul className="list-disc pl-5 space-y-2">
              {suggestions.map((s, i) => (
                <li key={i}>
                  {s.href ? <Link className="underline" href={s.href}>{s.text}</Link> : s.text}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
