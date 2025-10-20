"use client";

import { ServiceForm } from '@/components/service-form';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { listServicesByProvider } from '@/lib/services';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientLocale, tr } from '@/lib/i18n';

export default function NewServicePage() {
  const locale = getClientLocale();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasService, setHasService] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const rows = await listServicesByProvider(user.uid, 1);
        setHasService((rows || []).length > 0);
      } catch {
        // ignore
      } finally { setLoading(false); }
    })();
  }, [user?.uid]);

  const requestExtraSlot = async () => {
    if (!user) return;
    setRequesting(true); setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/service-slots/request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRequestedId(json.id);
    } catch (e: any) {
      setError(e?.message || 'request_failed');
    } finally { setRequesting(false); }
  };
  if (loading) return null;

  if (hasService) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>{locale === 'ar' ? 'طلب خدمة إضافية' : 'Request Additional Service Slot'}</CardTitle>
            <CardDescription>
              {locale === 'ar'
                ? 'يمكنك إنشاء خدمة واحدة يدويًا. إذا كنت بحاجة إلى خدمة أخرى، يرجى إرسال طلب وسيتم تطبيق رسوم.'
                : 'You can create one service manually. If you need another one, please submit a request (fees apply).'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
            {requestedId ? (
              <div className="rounded border bg-green-50 p-2 text-sm text-green-700">
                {locale === 'ar' ? 'تم إرسال الطلب. سنقوم بمراجعته قريبًا.' : 'Request submitted. We will review it shortly.'}
              </div>
            ) : (
              <Button onClick={requestExtraSlot} disabled={requesting}>
                {requesting ? (locale === 'ar' ? 'جارٍ الإرسال…' : 'Submitting…') : (locale === 'ar' ? 'إرسال طلب' : 'Submit Request')}
              </Button>
            )}
            <div className="pt-2 text-sm text-muted-foreground">
              {locale === 'ar'
                ? 'يمكنك أيضًا استخدام معالج الإنشاء بالذكاء الاصطناعي لإعداد التفاصيل، ثم إنشائها بعد الموافقة.'
                : 'You can also use the AI Seed Wizard to prepare details now, then create after approval.'}
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/services/seed">{locale === 'ar' ? 'فتح معالج الإنشاء' : 'Open Seed Wizard'}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{tr(locale, 'dashboard.serviceForm.newTitle')}</CardTitle>
          <CardDescription>
            {tr(locale, 'dashboard.serviceForm.newSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button variant="secondary" asChild>
              <Link href="/dashboard/services/seed">{locale === 'ar' ? 'جرّب معالج الإنشاء بالذكاء الاصطناعي' : 'Try the AI Seed Wizard'}</Link>
            </Button>
          </div>
          <ServiceForm />
        </CardContent>
      </Card>
    </div>
  );
}
