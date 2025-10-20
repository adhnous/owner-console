<<<<<<< HEAD
// src/app/layout.tsx
import './globals.css';
import NewServiceNotifier from '@/components/new-service-notifier';
import AuthBar from '@/components/auth-bar';
import Sidebar from '@/components/sidebar';
import OwnerGate from '@/components/owner-gate';

export const metadata = { title: 'Owner Console' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <NewServiceNotifier />

        <div className="min-h-screen flex">
          <Sidebar />
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              <AuthBar />
              <OwnerGate>{children}</OwnerGate>
            </div>
          </main>
        </div>
=======
import type { Metadata } from 'next';
import './globals.css';
import '@/styles/design-system.css';
import 'leaflet/dist/leaflet.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/hooks/use-auth';
import { cookies } from 'next/headers';
import SwRegister from '@/components/sw-register';
import AdStrip from '@/components/ad-strip';
import AppGate from '@/components/app-gate';
import BottomNav from '@/components/layout/bottom-nav';
import PwaInstall from '@/components/pwa-install';
import { PT_Sans, Tajawal, Cairo } from 'next/font/google';

// Cairo (default app font)
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300','400','600','700'],
  display: 'swap',
  variable: '--font-cairo',
});

// Optional: keep these variables in case you use them for specific components
const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Khidmaty Connect',
  description: 'Your connection to skilled professionals in Libya.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('locale')?.value || 'en').toLowerCase();
  const dir = locale.startsWith('ar') ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>

      <body className={`${cairo.variable} ${ptSans.variable} ${tajawal.variable} font-body antialiased bg-background text-foreground`}>
        <a href="#content" className="skip-link">{dir === 'rtl' ? 'تخطي إلى المحتوى' : 'Skip to content'}</a>
        <AuthProvider>
          <AdStrip />
          <AppGate>
            {/* reserve space for fixed BottomNav + iOS safe area */}
            <main id="content" className="min-h-[100svh] pt-2 pb-[calc(var(--bottom-nav-height,0px)+env(safe-area-inset-bottom))] md:pb-8">
              {children}
            </main>
            <PwaInstall />
            <BottomNav />
          </AppGate>
          <Toaster />
          <SwRegister />
        </AuthProvider>
>>>>>>> origin/main
      </body>
    </html>
  );
}
