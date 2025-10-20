import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { tr } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'About Khidmaty Connect',
  description: 'Learn about Khidmaty Connect — a local services marketplace for Libya connecting seekers with providers.',
};

export default async function AboutPage() {
  const cookieStore = await cookies();
  const cookieLocale = (cookieStore.get('locale')?.value || 'en').toLowerCase();
  const locale = (cookieLocale.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
      <section className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{tr(locale, 'pages.about.title')}</h1>
        <p className="text-muted-foreground">
          {locale === 'ar'
            ? 'خدمتي كونكت سوق محلي للخدمات في ليبيا. نساعد طالبي الخدمة على العثور على مقدّمين موثوقين، ونساعد المقدّمين على تنمية أعمالهم عبر الإنترنت.'
            : 'Khidmaty Connect is a local services marketplace for Libya. We help seekers find trusted providers and help providers grow their business online.'}
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'لطالبي الخدمة' : 'For Seekers'}</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>{locale === 'ar' ? 'ابحث حسب المدينة والمنطقة والفئة' : 'Search by city, area, and category'}</li>
              <li>{locale === 'ar' ? 'استكشف ملفات وأسعار المقدّمين' : 'Explore provider profiles and pricing'}</li>
              <li>{locale === 'ar' ? 'تواصل عبر الهاتف أو واتساب' : 'Contact via phone or WhatsApp'}</li>
            </ul>
          </div>
          <div className="rounded-lg border p-6">
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'للمقدّمين' : 'For Providers'}</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>{locale === 'ar' ? 'أنشئ ملفًا وانشر خدماتك' : 'Create a profile and publish your services'}</li>
              <li>{locale === 'ar' ? 'اعرض الصور والباقات' : 'Showcase photos and service packages'}</li>
              <li>{locale === 'ar' ? 'الوصول إلى عملاء في جميع أنحاء ليبيا' : 'Reach customers across Libya'}</li>
            </ul>
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'التقنية' : 'Technology'}</h2>
          <p className="text-sm text-muted-foreground">
            {locale === 'ar'
              ? 'مبني باستخدام Next.js وTypeScript وTailwind وFirebase وأدوات خرائط مجانية. نولي الأولوية للأداء والخصوصية وسهولة الاستخدام.'
              : 'Built with Next.js, TypeScript, Tailwind CSS, Firebase, and free mapping tools. We prioritize performance, privacy, and accessibility.'}
          </p>
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}
