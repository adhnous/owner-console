'use client';

import { LogIn, User, LogOut, Briefcase, Bell, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { tr } from '@/lib/i18n';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { getFcmToken, saveFcmToken } from '@/lib/messaging';
import { getFeatures } from '@/lib/settings';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export function Header() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showPricing, setShowPricing] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [lockActive, setLockActive] = useState(false);
  const [locale, setLocale] = useState<'en' | 'ar'>(() => {
    try {
      if (typeof document === 'undefined') return 'en';
      const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
      return lang.startsWith('ar') ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });

  const onLockPages = useMemo(() => {
    try {
      const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const lower = p.toLowerCase();
      return lower.includes('/pricing') || lower.includes('/checkout');
    } catch {
      return false;
    }
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      router.push('/');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Sign Out Failed', description: 'There was an error signing out.' });
    }
  };

  const getInitials = (email: string | null | undefined) => {
    return email ? email.substring(0, 2).toUpperCase() : 'AC';
  }

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )locale=([^;]+)/);
      const fromCookie = (match?.[1] || '').toLowerCase();
      const fromHtml = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
      const l = (fromCookie || fromHtml).startsWith('ar') ? 'ar' : 'en';
      setLocale(l);
    } catch {}
  }, []);

  // Hide interactive header items when the page is not visible (e.g., device lock, tab background)
  useEffect(() => {
    const update = () => {
      try {
        setIsPageVisible(!document.hidden);
      } catch {
        setIsPageVisible(true);
      }
    };
    const hide = () => setIsPageVisible(false);
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('pagehide', hide);
    // Also react to focus/blur so UI hides immediately when app loses focus
    window.addEventListener('focus', update);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Feature gating: Pricing visibility (owner-controlled + default after N months)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Local override: hide via URL or cookie
        const urlHide = !!(searchParams?.get('hidePricing') || searchParams?.get('noPricing'));
        const cookieHide = typeof document !== 'undefined' ? /(?:^|; )hidePricing=1/.test(document.cookie) : false;
        if (urlHide) {
          try { document.cookie = 'hidePricing=1; path=/; max-age=86400'; } catch {}
        }
        if (urlHide || cookieHide) {
          setShowPricing(false);
          setLockActive(false);
          return;
        }

        const f = await getFeatures();
        if (!alive) return;
        const role = userProfile?.role;
        const createdAtMs =
          (userProfile as any)?.createdAt?.toMillis?.() ??
          (user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0);
        const monthsSince = createdAtMs > 0 ? (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24 * 30) : 0;

        const pg = (userProfile as any)?.pricingGate || {};
        const forcedShow = pg?.mode === 'force_show';
        const forcedHide = pg?.mode === 'force_hide';
        const showAtObj = pg?.showAt;
        const showAtMs = (showAtObj?.toMillis?.() ?? (showAtObj ? Date.parse(showAtObj) : 0)) || 0;

        const lockedByRole = !!(f.lockAllToPricing || (role === 'provider' && f.lockProvidersToPricing) || (role === 'seeker' && f.lockSeekersToPricing));
        const plan = (userProfile?.plan ?? 'free') as string;
        const lockNow = forcedShow || (lockedByRole && plan === 'free');
        setLockActive(lockNow);

        const monthsLimit = (typeof pg?.enforceAfterMonths === 'number') ? pg.enforceAfterMonths : (f.enforceAfterMonths ?? 3);
        const byRole = (role === 'provider' && f.showForProviders) || (role === 'seeker' && f.showForSeekers);
        let show = false;
        if (forcedShow) show = true;
        else if (forcedHide) show = false;
        else show = false; // hide by default unless explicitly forced_show
        setShowPricing(show);
      } catch {
        setShowPricing(false);
        setLockActive(false);
      }
    })();
    return () => { alive = false };
  }, [user?.uid, userProfile?.role, (userProfile as any)?.pricingGate, userProfile?.plan, searchParams]);

  const toggleLocale = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    // Apply immediately for a smoother feel, then reload to re-render server side
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    window.location.reload();
  };

  const [notifLoading, setNotifLoading] = useState(false);
  const enableNotifications = async () => {
    if (!user) return;
    try {
      setNotifLoading(true);
      const token = await getFcmToken();
      if (!token) {
        const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        const description = granted
          ? (locale === 'ar'
              ? 'مفتاح VAPID لإشعارات الويب مفقود أو غير صالح. عيّن NEXT_PUBLIC_FIREBASE_VAPID_KEY إلى المفتاح العام من Firebase.'
              : 'Missing or invalid Web Push VAPID key. Set NEXT_PUBLIC_FIREBASE_VAPID_KEY to the PUBLIC key from Firebase Console.')
          : (locale === 'ar' ? 'تم رفض الإذن أو غير مدعوم.' : 'Permission denied or unsupported.');
        toast({ variant: 'destructive', title: (locale === 'ar' ? 'لم يتم تفعيل الإشعارات' : 'Notifications not enabled'), description });
        return;
      }
      await saveFcmToken(user.uid, token);
      toast({ title: (locale === 'ar' ? 'تم تفعيل الإشعارات' : 'Notifications enabled'), description: (locale === 'ar' ? 'ستتلقى تنبيهات عند وجود نشاط جديد.' : 'You will receive alerts for new activity.') });
    } catch (err) {
      toast({ variant: 'destructive', title: (locale === 'ar' ? 'فشل التفعيل' : 'Enable failed'), description: (locale === 'ar' ? 'تعذر تفعيل الإشعارات.' : 'Could not enable notifications.') });
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <header className="sticky z-30 w-full border-b bg-ink text-snow border-white/10 pt-safe" style={{ top: 'var(--ad-height, 0px)' }}>
      <div className="container flex h-14 md:h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-10 rounded-full text-snow hover:bg-white/10" aria-label={locale === 'ar' ? 'القائمة' : 'Menu'}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={locale === 'ar' ? 'right' : 'left'} className="w-72 max-w-[85vw]">
                <SheetHeader>
                  <SheetTitle>{locale === 'ar' ? 'القائمة' : 'Menu'}</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 grid gap-2">
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/">{tr(locale, 'header.browse')}</Link>
                  </Button>
                  {showPricing && (
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/pricing">{tr(locale, 'pages.pricing.nav')}</Link>
                    </Button>
                  )}
                  {userProfile?.role === 'provider' && (
                    <>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/dashboard">{tr(locale, 'header.providerDashboard')}</Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/dashboard/services/new">{tr(locale, 'header.addService')}</Link>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={toggleLocale}
                    aria-label={tr(locale, 'header.switch')}
                    title={tr(locale, 'header.switch')}
                  >
                    {locale === 'ar' ? 'English' : 'العربية'}
                  </Button>
                  {user ? (
                    <>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/dashboard/profile">{tr(locale, 'header.profile')}</Link>
                      </Button>
                      <Button variant="destructive" className="justify-start" onClick={handleSignOut}>
                        {tr(locale, 'header.signOut')}
                      </Button>
                    </>
                  ) : (
                    <Button className="justify-start" asChild>
                      <Link href="/login">
                        <LogIn className="mr-2 h-4 w-4" />
                        {tr(locale, 'header.login')}
                      </Link>
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          {(!lockActive && !onLockPages && isPageVisible) && (
            <>
              <nav className="hidden items-center gap-2 md:flex">
                <Button variant="ghost" className="text-snow hover:bg-white/10 font-medium" asChild>
                  <Link href="/">{tr(locale, 'header.browse')}</Link>
                </Button>
                { showPricing && (
                  <Button variant="ghost" className="text-snow hover:bg-white/10 font-medium" asChild>
                    <Link href="/pricing">{tr(locale, 'pages.pricing.nav')}</Link>
                  </Button>
                )}
                { userProfile?.role === 'provider' && (
                  <Button variant="ghost" className="text-snow hover:bg-white/10 font-medium" asChild>
                    <Link href="/dashboard">{tr(locale, 'header.providerDashboard')}</Link>
                  </Button>
                )}
              </nav>
              {user && userProfile?.role === 'provider' && (
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-copper hover:bg-copperDark text-ink font-semibold border-0"
                  asChild
                >
                  <Link href="/dashboard/services/new">
                    <Briefcase className="mr-1 h-4 w-4" />
                    {tr(locale, 'header.addService')}
                  </Link>
                </Button>
              )}
              {user && userProfile?.role === 'provider' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full text-snow hover:bg-white/10 border-0"
                  onClick={enableNotifications}
                  disabled={notifLoading}
                  title={locale === 'ar' ? 'تفعيل الإشعارات' : 'Enable notifications'}
                  aria-label={locale === 'ar' ? 'تفعيل الإشعارات' : 'Enable notifications'}
                >
                  <Bell className="mr-1 h-4 w-4" />
                  {locale === 'ar' ? 'الإشعارات' : 'Notifications'}
                </Button>
              )}
              <Button
                size="sm"
                className="h-9 rounded-full bg-snow px-4 md:px-3 text-ink hover:bg-snow/90 border-0 shadow-sm"
                onClick={toggleLocale}
                title={tr(locale, 'header.switch')}
                aria-label={tr(locale, 'header.switch')}
              >
                {locale === 'ar' ? 'EN' : 'AR'}
              </Button>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full text-primary-foreground">
                      <Avatar className="h-9 w-9 ring-1 ring-white/30">
                        <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                        <AvatarFallback className="bg-snow text-ink font-semibold">
                          {getInitials(user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName ?? 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userProfile?.role === 'provider' && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">
                          <Briefcase className="mr-2" />
                          {tr(locale, 'header.providerDashboard')}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {userProfile?.role === 'provider' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/services">
                            <Briefcase className="mr-2" />
                            {tr(locale, 'header.myServices')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/services/new">
                            <Briefcase className="mr-2" />
                            {tr(locale, 'header.addService')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <User className="mr-2" />
                        {tr(locale, 'header.profile')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2" />
                      {tr(locale, 'header.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    {tr(locale, 'header.login')}
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
