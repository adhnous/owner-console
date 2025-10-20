"use client";
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { tr } from '@/lib/i18n';

export function Footer() {
  const [locale, setLocale] = useState<'en' | 'ar'>(() => {
    try {
      const fromHtml = (typeof document !== 'undefined' ? (document.documentElement.getAttribute('lang') || 'en') : 'en').toLowerCase();
      return fromHtml.startsWith('ar') ? 'ar' : 'en';
    } catch { return 'en'; }
  });
  useEffect(() => {
    try {
      const fromHtml = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
      setLocale(fromHtml.startsWith('ar') ? 'ar' : 'en');
    } catch {}
  }, []);
  return (
    <footer className="border-t bg-background pb-safe">
      <div className="container py-6 md:py-8">
        <div className="flex flex-col items-center justify-between gap-6 md:gap-8 md:flex-row">
          <Logo />
          <nav className="flex flex-wrap justify-center gap-3 md:gap-6 text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-primary">
              {tr(locale, 'footer.about')}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-primary">
              {tr(locale, 'footer.terms')}
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-primary">
              {tr(locale, 'footer.privacy')}
            </Link>
            <Link href="/contact" className="transition-colors hover:text-primary">
              {tr(locale, 'footer.contact')}
            </Link>
          </nav>
        </div>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Khidmaty Connect. {tr(locale, 'footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
