"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getFeatures } from "@/lib/settings";
import { signOut } from "@/lib/auth";

export default function AppGate({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth() as any;
  const pathname = usePathname();
  const router = useRouter();
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [features, setFeatures] = useState<any>(null);

  // Load features
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const f = await getFeatures();
        if (!alive) return;
        setFeatures(f);
      } catch (error) {
        console.error('Failed to load features:', error);
      } finally {
        if (alive) setFeaturesLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Auth and routing logic
  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // Define allowed routes that bypass all checks
    const isAllowedRoute = (path: string) => 
      path.startsWith('/pricing') || 
      path.startsWith('/checkout') || 
      path.startsWith('/login') || 
      path.startsWith('/verify') || 
      path.startsWith('/_next') || 
      path.startsWith('/api');

    // If user is authenticated but profile is missing or disabled
    if (user && (!userProfile || userProfile?.status === 'disabled')) {
      console.log('User profile missing or disabled, signing out...');
      (async () => {
        try { 
          await signOut(); 
        } catch (error) {
          console.error('Sign out error:', error);
        } finally { 
          router.replace('/login'); 
        }
      })();
      return;
    }

    // If no user, nothing to check
    if (!user) return;

    const role = userProfile?.role || null;
    const plan = (userProfile?.plan ?? 'free') as string;
    const pricingGate = userProfile?.pricingGate || {};

    // Email verification check (with dev bypass)
    if (!user.emailVerified && !isAllowedRoute(pathname)) {
      const devBypass = (() => {
        try {
          if (process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === '1') return true;
          if (typeof window !== 'undefined' && localStorage.getItem('skipVerify') === '1') return true;
        } catch {}
        return false;
      })();
      if (!devBypass) {
        console.log('Email not verified, redirecting to verify page');
        router.replace('/verify');
        return;
      }
    }

    // Wait for features to load before doing role-based checks
    if (!featuresLoaded) return;

    // Owner/admin bypass all restrictions
    if (role === 'owner' || role === 'admin') return;

    // Force show pricing gate
    if (pricingGate.mode === 'force_show' && !isAllowedRoute(pathname)) {
      console.log('Pricing gate forced show, redirecting to pricing');
      router.replace('/pricing');
      return;
    }

    // Role-based pricing locks
    const lockedByRole = 
      features?.lockAllToPricing || 
      (role === 'provider' && features?.lockProvidersToPricing) || 
      (role === 'seeker' && features?.lockSeekersToPricing);

    if (lockedByRole && plan === 'free' && !isAllowedRoute(pathname)) {
      console.log('Role-based pricing lock active, redirecting to pricing');
      router.replace('/pricing');
    }
  }, [
    loading, 
    user, 
    userProfile, 
    pathname, 
    featuresLoaded, 
    features, 
    router
  ]);

  return <>{children}</>;
}