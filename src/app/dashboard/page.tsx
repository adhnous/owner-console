"use client";

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getClientLocale, tr } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { listProviderDailyStats } from '@/lib/analytics';
import { listServicesByProvider } from '@/lib/services';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const locale = getClientLocale();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [views7d, setViews7d] = useState(0);
  const [msgs7d, setMsgs7d] = useState(0);
  const [ctas7d, setCtas7d] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0);
  const [pendingSlotCount, setPendingSlotCount] = useState(0);
  const [chartData, setChartData] = useState<Array<{ day: string; views: number; ctas: number; messages: number }>>([]);
  const [topServices, setTopServices] = useState<Array<{ id: string; title: string; views: number; ctas: number; messages: number }>>([]);
  const [services, setServices] = useState<Array<any>>([]);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; href?: string }>>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      try { setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false); } catch { setIsMobile(false); }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        setLoading(true);
        // Services count
        const myServices = await listServicesByProvider(user.uid, 200);
        setServiceCount(myServices.length);
        setServices(myServices);
        // 30-day stats (build chart and 7d KPIs)
        const days = 30;
        const stats = await listProviderDailyStats(user.uid, days);
        const last7Threshold = (() => {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          return d.toISOString().slice(0, 10).replace(/-/g, '');
        })();
        setViews7d(stats.filter((r: any) => (r.yyyymmdd || '') >= last7Threshold).reduce((s: number, r: any) => s + (Number(r.views || 0)), 0));
        setMsgs7d(stats.filter((r: any) => (r.yyyymmdd || '') >= last7Threshold).reduce((s: number, r: any) => s + (Number(r.messages || 0)), 0));
        setCtas7d(stats.filter((r: any) => (r.yyyymmdd || '') >= last7Threshold).reduce((s: number, r: any) => s + (Number(r.ctas || 0)), 0));
        // Chart data aggregation
        const labels: string[] = (() => {
          const arr: string[] = [];
          const now = new Date();
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            arr.push(d.toISOString().slice(5, 10)); // MM-DD
          }
          return arr;
        })();
        const byDay = new Map<string, { day: string; views: number; ctas: number; messages: number }>();
        for (const l of labels) byDay.set(l, { day: l, views: 0, ctas: 0, messages: 0 });
        for (const r of stats as any[]) {
          const yyyymmdd = String(r.yyyymmdd || '');
          if (yyyymmdd.length >= 8) {
            const label = `${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`; // MM-DD
            const prev = byDay.get(label) || { day: label, views: 0, ctas: 0, messages: 0 };
            byDay.set(label, { day: label, views: prev.views + (r.views || 0), ctas: prev.ctas + (r.ctas || 0), messages: prev.messages + (r.messages || 0) });
          }
        }
        const chartArr = Array.from(byDay.values());
        setChartData(chartArr);
        // Top services by views in 30d
        const agg = new Map<string, { views: number; ctas: number; messages: number }>();
        for (const r of stats as any[]) {
          const k = String(r.serviceId || '');
          if (!k) continue;
          const prev = agg.get(k) || { views: 0, ctas: 0, messages: 0 };
          agg.set(k, { views: prev.views + (r.views || 0), ctas: prev.ctas + (r.ctas || 0), messages: prev.messages + (r.messages || 0) });
        }
        const nameById = new Map<string, string>();
        for (const s of myServices) nameById.set(String((s as any).id), String((s as any).title || (s as any).id));
        const perf = Array.from(agg.entries()).map(([id, v]) => ({ id, title: nameById.get(id) || id, ...v }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);
        setTopServices(perf);
        // Suggestions (lightweight)
        const totals = chartArr.reduce((acc, r) => ({ views: acc.views + r.views, ctas: acc.ctas + r.ctas, messages: acc.messages + r.messages }), { views: 0, ctas: 0, messages: 0 });
        const ctr = totals.views > 0 ? totals.ctas / totals.views : 0;
        const msgRate = totals.views > 0 ? totals.messages / totals.views : 0;
        const tips: Array<{ text: string; href?: string }> = [];
        // Global KPIs
        if (totals.views >= 50 && ctr < 0.03) {
          const top = perf.find((p) => p.views > 0);
          tips.push({ text: (locale === 'ar' ? 'نسبة التواصل منخفضة. حسّن صورة الغلاف والعنوان لأكثر خدمة مشاهدة.' : 'Low contact CTR. Improve cover image and title on your most-viewed service.'), href: top ? `/dashboard/services/${top.id}/edit` : undefined });
        }
        if (totals.views >= 50 && msgRate < 0.01) {
          const top = perf.find((p) => p.views > 0);
          tips.push({ text: (locale === 'ar' ? 'عدد الرسائل قليل مقارنة بالمشاهدات. أضف واتساب/هاتف أو دعوة أوضح في الوصف.' : 'Few messages vs. views. Add WhatsApp/phone or clearer CTA in description.'), href: top ? `/dashboard/services/${top.id}/edit` : undefined });
        }
        // Content checks per service
        for (const s of myServices) {
          const href = s.id ? `/dashboard/services/${s.id}/edit` : undefined;
          const imgs = Array.isArray(s.images) ? s.images : [];
          if (imgs.length === 0) tips.push({ text: (locale === 'ar' ? `أضف صورًا إلى "${s.title}".` : `Add images to "${s.title}".`), href });
          if (!s.videoUrl && !(s.videoUrls && s.videoUrls.length)) tips.push({ text: (locale === 'ar' ? `فكّر بإضافة فيديو قصير إلى "${s.title}".` : `Consider adding a short video to "${s.title}".`), href });
          if (!s.contactPhone && !s.contactWhatsapp) tips.push({ text: (locale === 'ar' ? `أضف وسيلة تواصل لخدمة "${s.title}" (هاتف أو واتساب).` : `Add a contact method for "${s.title}" (phone or WhatsApp).`), href });
          if (!s.lat || !s.lng) tips.push({ text: (locale === 'ar' ? `حدّد موقعًا دقيقًا على الخريطة لـ "${s.title}".` : `Set a precise map location for "${s.title}".`), href });
          if ((s.price ?? 0) <= 0) tips.push({ text: (locale === 'ar' ? `اضبط سعرًا واضحًا لـ "${s.title}".` : `Set a clear price for "${s.title}".`), href });
        }
        const seen = new Set<string>();
        setSuggestions(tips.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true))).slice(0, 8));
        // Pending requests owned by this user
        const delQ = query(
          collection(db, 'service_deletion_requests'),
          where('uid', '==', user.uid),
          where('status', '==', 'pending'),
        );
        const delSnap = await getDocs(delQ);
        setPendingDeletionCount(delSnap.docs.length);
        const slotQ = query(
          collection(db, 'service_slot_requests'),
          where('uid', '==', user.uid),
          where('status', '==', 'pending'),
        );
        const slotSnap = await getDocs(slotQ);
        setPendingSlotCount(slotSnap.docs.length);
      } catch {
        // ignore; keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr(locale, 'dashboard.welcome.title')}</CardTitle>
        <CardDescription>
          {tr(locale, 'dashboard.welcome.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Alerts */}
        {(pendingDeletionCount > 0 || pendingSlotCount > 0) && (
          <div className="mb-4 space-y-2">
            {pendingDeletionCount > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
                {t('You have a deletion request pending review.', 'لديك طلب حذف قيد المراجعة.')}
              </div>
            )}
            {pendingSlotCount > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
                {t('Your extra slot request is pending review.', 'طلب فتحة خدمة إضافية قيد المراجعة.')}
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-6 rounded-md border p-3 md:p-4">
            <div className="mb-2 text-sm text-muted-foreground">{t('Suggestions', 'اقتراحات')}</div>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {suggestions.map((s, i) => (
                <li key={i}>
                  {s.href ? <Link className="underline" href={s.href}>{s.text}</Link> : s.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3 md:p-4">
            <div className="text-sm text-muted-foreground">{t('My services', 'خدماتي')}</div>
            <div className="text-xl md:text-2xl font-semibold">{loading ? '—' : serviceCount}</div>
          </div>
          <div className="rounded-md border p-3 md:p-4">
            <div className="text-sm text-muted-foreground">{t('Views (7 days)', 'المشاهدات (7 أيام)')}</div>
            <div className="text-xl md:text-2xl font-semibold">{loading ? '—' : views7d}</div>
          </div>
          <div className="rounded-md border p-3 md:p-4">
            <div className="text-sm text-muted-foreground">{t('Contacts (7 days)', 'التواصل (7 أيام)')}</div>
            <div className="text-xl md:text-2xl font-semibold">{loading ? '—' : ctas7d}</div>
          </div>
          <div className="rounded-md border p-3 md:p-4">
            <div className="text-sm text-muted-foreground">{t('Messages (7 days)', 'الرسائل (7 أيام)')}</div>
            <div className="text-xl md:text-2xl font-semibold">{loading ? '—' : msgs7d}</div>
          </div>
        </div>

        {/* 30d KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(() => {
            const totals = chartData.reduce((acc, r) => ({ views: acc.views + r.views, ctas: acc.ctas + r.ctas, messages: acc.messages + r.messages }), { views: 0, ctas: 0, messages: 0 });
            const ctr = totals.views > 0 ? (totals.ctas / totals.views) * 100 : 0;
            const msg = totals.views > 0 ? (totals.messages / totals.views) * 100 : 0;
            return (
              <>
                <div className="rounded-md border p-3 md:p-4">
                  <div className="text-sm text-muted-foreground">{t('Views (30 days)', 'المشاهدات (30 يوم)')}</div>
                  <div className="text-xl md:text-2xl font-semibold">{totals.views.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-3 md:p-4">
                  <div className="text-sm text-muted-foreground">{t('Contacts (30 days)', 'التواصل (30 يوم)')}</div>
                  <div className="text-xl md:text-2xl font-semibold">{totals.ctas.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-3 md:p-4">
                  <div className="text-sm text-muted-foreground">{t('Messages (30 days)', 'الرسائل (30 يوم)')}</div>
                  <div className="text-xl md:text-2xl font-semibold">{totals.messages.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-3 md:p-4">
                  <div className="text-sm text-muted-foreground">{t('CTR', 'معدل النقر للتواصل')}</div>
                  <div className="text-xl md:text-2xl font-semibold">{ctr.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">{t('Contact clicks / Views (30d)', 'نقرات التواصل / المشاهدات (30 يوم)')}</div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Chart + Top services */}
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-md border p-3 xl:col-span-2">
            <div className="mb-2 text-sm text-muted-foreground">{t('Last 30 days', 'آخر 30 يوم')}</div>
            <div className="h-48 md:h-64">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ display: isMobile ? 'none' : undefined }} />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" name={t('Views', 'المشاهدات')} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ctas" stroke="#16a34a" name={t('Contacts', 'التواصل')} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="messages" stroke="#f59e0b" name={t('Messages', 'الرسائل')} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm text-muted-foreground">{t('Top services (30d)', 'أفضل الخدمات (30 يوم)')}</div>
            {topServices.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('No data yet.', 'لا توجد بيانات بعد.')}</div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1.5 md:py-2 pr-3">{t('Service', 'الخدمة')}</th>
                      <th className="py-1.5 md:py-2 pr-3">{t('Views', 'المشاهدات')}</th>
                      <th className="py-1.5 md:py-2 pr-3">{t('Contacts', 'التواصل')}</th>
                      <th className="py-1.5 md:py-2 pr-3">{t('Messages', 'الرسائل')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topServices.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1.5 md:py-2 pr-3 max-w-[200px] md:max-w-[260px] truncate">{r.title}</td>
                        <td className="py-1.5 md:py-2 pr-3">{r.views}</td>
                        <td className="py-1.5 md:py-2 pr-3">{r.ctas}</td>
                        <td className="py-1.5 md:py-2 pr-3">{r.messages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <p className="mb-3">{tr(locale, 'dashboard.welcome.prompt')}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/services">{tr(locale, 'dashboard.welcome.goServices')}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard/services/new">{tr(locale, 'dashboard.welcome.addService')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/services/seed">{t('Open Seed Wizard', 'معالج الإنشاء بالذكاء الاصطناعي')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
