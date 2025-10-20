import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { tr } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Terms of Service — Khidmaty Connect',
  description: 'The terms and conditions for using Khidmaty Connect.',
};

export default async function TermsPage() {
  const cookieStore = await cookies();
  const cookieLocale = (cookieStore.get('locale')?.value || 'en').toLowerCase();
  const locale = (cookieLocale.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container max-w-4xl flex-1 px-4 py-12">
        <h1 className="mb-4 text-3xl font-bold">{tr(locale, 'pages.terms.title')}</h1>
        <p className="mb-8 text-muted-foreground">
          {locale === 'ar'
            ? 'باستخدامك لمنصّة خدمتي كونكت، فأنت توافق على شروط الخدمة التالية. يرجى قراءة هذه الشروط بعناية.'
            : 'By using Khidmaty Connect, you agree to the following Terms of Service. Please read them carefully.'}
        </p>
        <section className="space-y-4 text-sm leading-7 text-muted-foreground">
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'الحساب والاستخدام' : 'Account & Usage'}</h2>
            <p>{locale === 'ar'
              ? 'أنت مسؤول عن الحفاظ على سرية بيانات حسابك، وعن جميع الأنشطة التي تتم من خلاله.'
              : 'You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.'}
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'المحتوى' : 'Content'}</h2>
            <p>{locale === 'ar'
              ? 'يجب أن يكون المحتوى الخاص بك دقيقًا وقانونيًا. نحتفظ بحق إزالة أي محتوى مخالف.'
              : 'Your content must be accurate and lawful. We may remove any content that violates our guidelines.'}
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold">{locale === 'ar' ? 'المسؤولية' : 'Liability'}</h2>
            <p>{locale === 'ar'
              ? 'توفر المنصة وساطة بين طالبي الخدمة والمقدّمين دون أي ضمانات صريحة أو ضمنية.'
              : 'The platform facilitates connections between seekers and providers and is provided without warranties of any kind.'}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
