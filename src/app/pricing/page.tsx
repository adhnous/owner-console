"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getClientLocale, tr } from "@/lib/i18n";
import { plans } from "@/lib/plans";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { getFeatures } from "@/lib/settings";
import { getIdTokenOrThrow } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const locale = getClientLocale();
  const { user, userProfile } = useAuth();
  const [allowed, setAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const f = await getFeatures();
        const role = userProfile?.role;
        // If owner lock is active, always allow the pricing page regardless of global switches
        const lockedByRole = !!(f.lockAllToPricing || (role === 'provider' && f.lockProvidersToPricing) || (role === 'seeker' && f.lockSeekersToPricing));
        if (lockedByRole) { if (alive) setAllowed(true); return; }
        const createdAtMs =
          (userProfile as any)?.createdAt?.toMillis?.() ??
          (user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0);
        const monthsSince = createdAtMs > 0 ? (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24 * 30) : 0;
        // Per-user overrides
        const pg = (userProfile as any)?.pricingGate || {};
        if (pg?.mode === 'force_show') { if (alive) setAllowed(true); return; }
        if (pg?.mode === 'force_hide') { if (alive) setAllowed(false); return; }
        const showAtObj = pg?.showAt;
        const showAtMs = (showAtObj?.toMillis?.() ?? (showAtObj ? Date.parse(showAtObj) : 0)) || 0;
        if (showAtMs && Date.now() >= showAtMs) { if (alive) setAllowed(true); return; }
        const monthsLimit = (typeof pg?.enforceAfterMonths === 'number') ? pg.enforceAfterMonths : (f.enforceAfterMonths ?? 3);
        const byRole = (role === 'provider' && f.showForProviders) || (role === 'seeker' && f.showForSeekers);
        const byAge = monthsSince >= monthsLimit;
        const vis = !!(f.pricingEnabled && (byRole || byAge));
        if (alive) setAllowed(vis);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false };
  }, [user?.uid, userProfile?.role]);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-snow">
      <Header />
      <main className="flex-1">
        {!allowed && !loading && (
          <section className="py-16">
            <div className="container">
              <Card className="mx-auto max-w-2xl bg-background text-foreground border-white/10">
                <CardHeader>
                  <CardTitle>Pricing is not available</CardTitle>
                  <CardDescription>Check back later, or contact support.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>
        )}
        {allowed && (
        <section className="py-16">
          <div className="container">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h1 className="mb-2 text-4xl font-extrabold font-headline">
                {tr(locale, "pages.pricing.title")}
              </h1>
              <p className="text-snow/80">{tr(locale, "pages.pricing.subtitle")}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((p) => {
                const name = tr(locale, p.nameKey);
                const per = tr(locale, p.perKey || "pages.pricing.perMonth");
                const isCurrent = (userProfile?.plan ?? 'free') === p.id;
                return (
                  <Card key={p.id} className={`border-white/10 bg-background text-foreground ${p.recommended ? "ring-2 ring-copper" : ""}`}>
                    <CardHeader>
                      <CardTitle className="flex items-baseline justify-between">
                        <span>{name}</span>
                        {p.recommended && (
                          <span className="rounded-full bg-copper px-2 py-1 text-xs font-semibold text-ink">Recommended</span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        <span className="text-3xl font-bold text-foreground">${p.price}</span>
                        <span className="ml-2 text-muted-foreground">{per}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="mb-6 space-y-2 text-sm">
                        {p.featuresKeys.map((fk) => (
                          <li key={fk} className="flex items-start gap-2">
                            <Check className="mt-[2px] h-4 w-4 text-green-500" />
                            <span>{tr(locale, fk)}</span>
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Button disabled className="w-full bg-gray-300 text-ink">
                          Current plan
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-copper text-ink hover:bg-copperDark"
                          disabled={!user || savingId === p.id}
                          onClick={async () => {
                            if (!user) { window.location.href = '/login'; return; }
                            try {
                              setSavingId(p.id);
                              // Create a payment transaction through backend
                              const token = await getIdTokenOrThrow();
                              const res = await fetch('/api/payments/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ planId: p.id, provider: 'mock' }),
                              });
                              const json = await res.json();
                              if (!res.ok) throw new Error(json?.error || 'payment_create_failed');
                              // Navigate to checkout page (can host QR / wallet instructions)
                              router.push(`/checkout/${json.id}`);
                            } catch (e) {
                              alert('Failed to set plan');
                            } finally {
                              setSavingId("");
                            }
                          }}
                        >
                          {savingId === p.id ? 'Saving…' : tr(locale, "pages.pricing.choosePlan")}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
