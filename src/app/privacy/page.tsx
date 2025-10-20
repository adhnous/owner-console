import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { tr } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Privacy Policy — Khidmaty Connect',
  description: 'How Khidmaty Connect collects, uses, and protects your personal information.',
};

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const cookieLocale = (cookieStore.get('locale')?.value || 'en').toLowerCase();
  const locale = (cookieLocale.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container max-w-4xl flex-1 px-4 py-12">
        <h1 className="mb-4 text-3xl font-bold">{tr(locale, 'pages.privacy.title')}</h1>
        <p className="mb-8 text-muted-foreground">
          {locale === 'ar'
            ? 'خصوصيتك مهمة لنا. توضح هذه السياسة كيفية جمع معلوماتك الشخصية واستخدامها وحمايتها.'
            : 'Your privacy is important to us. This policy explains how your personal information is collected, used, and protected.'}
        </p>
        <section className="space-y-4 text-sm leading-7 text-muted-foreground">
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'المعلومات التي نجمعها' : 'Information We Collect'}</h2>
            <p>{locale === 'ar' ? 'نقوم بجمع معلومات الحساب ومحتوى الخدمة وبيانات الاستخدام لتحسين التجربة.' : 'We collect account information, service content, and usage data to improve your experience.'}</p>
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'كيفية الاستخدام' : 'How We Use It'}</h2>
            <p>{locale === 'ar' ? 'نستخدم البيانات لتقديم الخدمات وتحسينها، ولأغراض الأمان والامتثال.' : 'Data is used to provide and improve the service, and for security and compliance purposes.'}</p>
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'حقوقك' : 'Your Rights'}</h2>
            <p>{locale === 'ar' ? 'يمكنك الوصول إلى بياناتك وتحديثها أو حذفها وفقًا للقوانين المعمول بها.' : 'You can access, update, or delete your data as permitted by applicable law.'}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
