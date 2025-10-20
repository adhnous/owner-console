import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { tr } from '@/lib/i18n';
import ContactForm from '@/components/contact-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Contact — Khidmaty Connect',
  description: 'Get in touch with Khidmaty Connect. Send us a message and we will respond soon.',
};

export default async function ContactPage() {
  const cookieStore = await cookies();
  const cookieLocale = (cookieStore.get('locale')?.value || 'en').toLowerCase();
  const locale = (cookieLocale.startsWith('ar') ? 'ar' : 'en') as 'en' | 'ar';
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container max-w-2xl flex-1 px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">{tr(locale, 'footer.contact')}</h1>
        <p className="mb-6 text-muted-foreground">
          {locale === 'ar' ? 'راسلنا عبر النموذج التالي وسنرد عليك قريبًا.' : 'Send us a message using the form below and we will respond shortly.'}
        </p>
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
