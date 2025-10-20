"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getClientLocale, tr } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listServicesByProvider, createService, type Service } from '@/lib/services';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';

async function apiImproveTitle(args: { title: string; description: string; category: string }) {
  const res = await fetch('/api/ai/improve-title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { improvedTitle: string };
}

async function apiAutoCategorize(args: { description: string }) {
  const res = await fetch('/api/ai/auto-categorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { categorySuggestions: string[] };
}

export default function SeedServiceWizardPage() {
  const locale = getClientLocale();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasService, setHasService] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestedId, setRequestedId] = useState<string | null>(null);

  // Inputs
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState<Record<string, boolean>>({});

  // Outputs
  const [generating, startGen] = useTransition();
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const rows = await listServicesByProvider(user.uid, 1);
        setHasService((rows || []).length > 0);
      } finally { setLoading(false); }
    })();
  }, [user?.uid]);

  const taskList = useMemo(() => {
    const en = [
      'Inspection & diagnostics',
      'Installation',
      'Repair & maintenance',
      'Cleaning & finishing',
      'Emergency call-out',
      'Parts & materials supply',
      'Warranty / guarantee',
    ];
    const ar = [
      'فحص وتشخيص',
      'تركيب',
      'صيانة وإصلاح',
      'تنظيف وإنهاء العمل',
      'خدمة طارئة',
      'توفير قطع الغيار والمواد',
      'ضمان / كفالة',
    ];
    return locale === 'ar' ? ar : en;
  }, [locale]);

  const descFromChecklist = useMemo(() => {
    const chosen = taskList.filter((name, idx) => tasks[String(idx)]);
    const items = chosen.join(locale === 'ar' ? '، ' : ', ');
    const base = locale === 'ar'
      ? 'خدمة احترافية تشمل: '
      : 'Professional service covering: ';
    const tail = notes?.trim() ? `\n\n${notes.trim()}` : '';
    return `${base}${items}${tail}`.trim();
  }, [tasks, taskList, notes, locale]);

  const generate = () => startGen(async () => {
    try {
      let cat = category.trim();
      if (!cat) {
        const ac = await apiAutoCategorize({ description: descFromChecklist || title });
        setCategorySuggestions(ac.categorySuggestions || []);
        cat = ac.categorySuggestions?.[0] || '';
      }
      if (title.trim()) {
        const it = await apiImproveTitle({ title: title.trim(), description: descFromChecklist, category: cat || 'General' });
        setSuggestedTitle(it.improvedTitle);
      }
      toast({ title: locale === 'ar' ? 'تم التحضير' : 'Draft prepared' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'فشل الإنشاء' : 'Generation failed', description: e?.message || '' });
    }
  });

  const toggleTask = (idx: number) => setTasks(prev => ({ ...prev, [String(idx)]: !prev[String(idx)] }));

  const requestExtraSlot = async () => {
    if (!user) return;
    setRequesting(true);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/service-slots/request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setRequestedId(json.id);
      toast({ title: locale === 'ar' ? 'تم إرسال الطلب' : 'Request submitted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: locale === 'ar' ? 'فشل الطلب' : 'Request failed', description: e?.message || '' });
    } finally {
      setRequesting(false);
    }
  };

  const create = async () => {
    if (!user) { router.push('/login'); return; }
    const chosen = taskList.filter((_, idx) => tasks[String(idx)]);
    const subs = chosen.map((t, i) => ({ id: `t_${i}`, title: t, price: 0, unit: '' }));
    const payload: Omit<Service, 'id' | 'createdAt'> = {
      title: (suggestedTitle || title || '').trim() || (locale === 'ar' ? 'خدمة جديدة' : 'New Service'),
      description: descFromChecklist || (locale === 'ar' ? 'تفاصيل حسب الطلب' : 'Details on request'),
      price: 0,
      category: (category || categorySuggestions[0] || 'General'),
      city: 'Tripoli',
      area: '',
      availabilityNote: '',
      images: [],
      contactPhone: '',
      contactWhatsapp: '',
      videoUrl: '',
      videoUrls: [],
      facebookUrl: '',
      telegramUrl: '',
      providerId: user.uid,
      providerName: user.displayName || null,
      providerEmail: user.email || null,
      subservices: subs,
      status: 'pending',
      lat: undefined,
      lng: undefined,
    } as any;

    try {
      const id = await createService(payload);
      toast({ title: locale === 'ar' ? 'تم الإنشاء' : 'Created' });
      router.push(`/services/${id}`);
    } catch (e: any) {
      const msg = String(e?.message || 'create_failed');
      if (msg.includes('limit_exceeded')) {
        toast({ variant: 'destructive', title: locale === 'ar' ? 'تم الوصول إلى الحد' : 'Limit reached', description: locale === 'ar' ? 'لإنشاء خدمة أخرى، أرسل طلبًا.' : 'To create another service, please submit a request.' });
      } else {
        toast({ variant: 'destructive', title: locale === 'ar' ? 'فشل الإنشاء' : 'Create failed', description: msg });
      }
    }
  };

  if (loading) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{locale === 'ar' ? 'معالج إنشاء الخدمة' : 'Service Seed Wizard'}</CardTitle>
          <CardDescription>
            {locale === 'ar' ? 'اختر عناصر من القائمة وسنساعدك في صياغة خدمة واضحة وجاهزة للإنشاء.' : 'Pick a few checklist items and we will help you craft a clear service ready to create.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">{locale === 'ar' ? 'العنوان المبدئي' : 'Initial title'}</label>
            <div className="flex items-center gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={locale === 'ar' ? 'مثال: سباكة منزلية احترافية' : 'e.g., Professional home plumbing'} />
              <Button type="button" variant="outline" onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} {locale === 'ar' ? 'توليد' : 'Generate'}
              </Button>
            </div>
            {!!suggestedTitle && (
              <div className="mt-2 text-sm text-muted-foreground">
                {locale === 'ar' ? 'العنوان المقترح:' : 'Suggested title:'} <span className="font-semibold">{suggestedTitle}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{locale === 'ar' ? 'الفئة' : 'Category'}</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={locale === 'ar' ? 'مثال: سباكة' : 'e.g., Plumbing'} />
            {categorySuggestions.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                {locale === 'ar' ? 'اقتراحات:' : 'Suggestions:'} {categorySuggestions.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'قائمة الاختيار للخدمة' : 'Service checklist'}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {taskList.map((t, idx) => (
                <label key={idx} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!tasks[String(idx)]} onChange={() => toggleTask(idx)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{locale === 'ar' ? 'ملاحظات إضافية' : 'Additional notes'}</label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={locale === 'ar' ? 'أدخل تفاصيل تساعد الذكاء الاصطناعي' : 'Provide any details to help AI craft a better draft'} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!hasService ? (
              <Button onClick={create} disabled={generating}>{locale === 'ar' ? 'إنشاء الخدمة' : 'Create service'}</Button>
            ) : requestedId ? (
              <div className="rounded border bg-green-50 p-2 text-sm text-green-700">{locale === 'ar' ? 'تم إرسال طلب فتحة إضافية.' : 'Extra slot request submitted.'}</div>
            ) : (
              <Button variant="outline" onClick={requestExtraSlot} disabled={requesting}>{locale === 'ar' ? 'طلب فتحة إضافية' : 'Request extra slot'}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
