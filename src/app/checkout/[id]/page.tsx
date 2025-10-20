"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getIdTokenOrThrow } from "@/lib/auth-client";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getClientLocale } from "@/lib/i18n";

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const locale = getClientLocale();
  const txt = useMemo(() => {
    if (locale === 'ar') {
      return {
        title: 'إتمام الدفع',
        subtitle: 'أكمل الدفع لتفعيل اشتراكك.',
        loading: 'جارٍ التحميل…',
        txId: 'معرّف العملية',
        plan: 'الخطة',
        amount: 'المبلغ',
        status: 'الحالة',
        statusLabels: { pending: 'قيد الانتظار', success: 'تم الدفع', failed: 'فشل', cancelled: 'أُلغيت' } as Record<string, string>,
        scanHelp: 'امسح باستخدام تطبيق المحفظة',
        openWallet: 'فتح في تطبيق المحفظة',
        copyCode: 'نسخ رمز الدفع',
        refresh: 'لقد دفعت، تحديث',
        openWeb: 'فتح المحفظة (ويب)',
        openFail: 'تعذر فتح تطبيق المحفظة. إذا لم يكن مثبتًا، امسح رمز QR أو انسخ رمز الدفع.',
        desktopHint: 'على الجوال، اضغط "فتح في تطبيق المحفظة". على الحاسوب، امسح رمز QR. ستتحدّث هذه الصفحة تلقائيًا بعد تأكيد الدفع.',
        failedNotice: 'فشلت عملية الدفع. الرجاء العودة إلى صفحة الأسعار والمحاولة مرة أخرى.',
        cancelledNotice: 'تم إلغاء عملية الدفع. يمكنك المحاولة مرة أخرى من صفحة الأسعار.',
        paymentDetails: 'تفاصيل الدفع',
        copyId: 'نسخ المعرّف',
        copied: 'تم النسخ!'
      };
    }
    return {
      title: 'Checkout',
      subtitle: 'Complete your payment to activate your subscription.',
      loading: 'Loading…',
      txId: 'Transaction ID',
      plan: 'Plan',
      amount: 'Amount',
      status: 'Status',
      statusLabels: { pending: 'Pending', success: 'Paid', failed: 'Failed', cancelled: 'Cancelled' } as Record<string, string>,
      scanHelp: 'Scan with your wallet app',
      openWallet: 'Open in Wallet app',
      copyCode: 'Copy payment code',
      refresh: "I've paid, refresh",
      openWeb: 'Open Wallet (web)',
      openFail: 'Could not open a wallet app. If not installed, scan the QR or copy the payment code.',
      desktopHint: 'On mobile, tap “Open in Wallet app”. On desktop, scan the QR. This page will update automatically after payment is confirmed.',
      failedNotice: 'Payment failed. Please go back to Pricing and try again.',
      cancelledNotice: 'Payment was cancelled. You can try again from Pricing.',
      paymentDetails: 'Payment details',
      copyId: 'Copy ID',
      copied: 'Copied!'
    };
  }, [locale]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<any | null>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const [copyIdMsg, setCopyIdMsg] = useState<string | null>(null);

  const isProvider = (userProfile?.role === 'provider');

  const load = async () => {
    if (!id) return;
    try {
      setError(null);
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/payments/tx/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setTx(json.tx);
    } catch (e: any) {
      setError(e?.message || 'Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Poll transaction status until success/failed/cancelled
  useEffect(() => {
    if (!tx) return;
    if (tx.status === 'success') {
      // Plan is already updated by server; route accordingly
      if (isProvider) router.replace('/dashboard'); else router.replace('/');
      return;
    }
    if (tx.status !== 'pending') return;
    const t = setInterval(() => { load(); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.status, isProvider]);

  // Build a mock QR payload. Prefer a deeplink-like URL that a wallet could handle.
  const qrPayload = useMemo(() => {
    if (!tx) return '';
    const deeplink = `khidmaty-mock://pay?tx=${encodeURIComponent(String(id))}&amt=${encodeURIComponent(String(tx.amount || ''))}&cur=${encodeURIComponent(String(tx.currency || 'LYD'))}&p=${encodeURIComponent(String(tx.provider || 'mock'))}`;
    // If backend provided a checkoutUrl that isn't just the same page, use it; else use deeplink
    const url = typeof tx.checkoutUrl === 'string' && !String(tx.checkoutUrl).includes('/checkout/')
      ? String(tx.checkoutUrl)
      : deeplink;
    return url;
  }, [tx, id]);

  // Platform-aware open link: prefer provider checkoutUrl; else Android intent deep link; else custom scheme
  const openHref = useMemo(() => {
    if (!tx) return '';
    if (typeof tx.checkoutUrl === 'string' && tx.checkoutUrl) return String(tx.checkoutUrl);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      const fallback = typeof window !== 'undefined' ? window.location.origin + `/checkout/${id}` : '';
      // Android intent format with mock package; falls back to this page/help
      const intent = `intent://pay?tx=${encodeURIComponent(String(id))}&amt=${encodeURIComponent(String(tx.amount || ''))}&cur=${encodeURIComponent(String(tx.currency || 'LYD'))}&p=${encodeURIComponent(String(tx.provider || 'mock'))}#Intent;scheme=khidmaty-mock;package=com.khidmaty.mockwallet;S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
      return intent;
    }
    // iOS and others: use the custom scheme (will show chooser or no-op if not installed)
    return qrPayload;
  }, [tx, id, qrPayload]);

  const showWebWallet = useMemo(() => {
    const u = String(tx?.checkoutUrl || '');
    return !!u && !u.includes('/checkout/');
  }, [tx?.checkoutUrl]);

  const shortId = useMemo(() => {
    const s = String(id || '');
    if (s.length <= 14) return s;
    return `${s.slice(0, 6)}…${s.slice(-6)}`;
  }, [id]);

  function tryOpenWallet() {
    if (!openHref) return;
    setOpenMsg(null);
    const start = Date.now();
    try {
      // Prefer setting location to avoid popup blockers.
      window.location.href = openHref;
    } catch {}
    // If nothing handled it within ~1.2s, show guidance.
    setTimeout(() => {
      if (Date.now() - start < 1200) {
        setOpenMsg('Could not open a wallet app. If you do not have a compatible wallet installed, scan the QR from another device or copy the payment code.');
      }
    }, 1200);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink text-snow">
      <Header />
      <main className="flex-1">
        <section className="py-16">
          <div className="container">
            <Card className="mx-auto max-w-2xl bg-background text-foreground border-white/10">
              <CardHeader>
                <CardTitle>{txt.title}</CardTitle>
                <CardDescription>
                  {txt.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                {loading ? (
                  <div>{txt.loading}</div>
                ) : error ? (
                  <div className="text-red-500">{error}</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>{txt.plan}</div>
                      <div className="font-semibold uppercase">{tx?.planId}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>{txt.amount}</div>
                      <div className="font-semibold">{tx?.amount} {tx?.currency || 'LYD'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>{txt.status}</div>
                      <div className="font-semibold">{txt.statusLabels[String(tx?.status)] || String(tx?.status)}</div>
                    </div>

                    <div>
                      <details className="group rounded-lg border border-white/10 bg-muted/10 open:bg-muted/10">
                        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                          <span>{txt.paymentDetails}</span>
                          <span className="transition-transform group-open:rotate-90">›</span>
                        </summary>
                        <div className="px-3 pb-3 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">{txt.txId}:</span>
                            <code className="bg-muted/30 text-foreground/80 px-1.5 py-0.5 rounded break-all">{String(id)}</code>
                            <Button
                              variant="secondary"
                              className="h-7 px-2"
                              onClick={() => {
                                navigator.clipboard?.writeText(String(id));
                                setCopyIdMsg(txt.copied);
                                setTimeout(() => setCopyIdMsg(null), 1200);
                              }}
                            >
                              {copyIdMsg || txt.copyId}
                            </Button>
                          </div>
                        </div>
                      </details>
                    </div>

                    {tx?.status === 'pending' && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                          <img
                            alt="Payment QR"
                            width={224}
                            height={224}
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=${encodeURIComponent(qrPayload)}`}
                            className="rounded-xl border w-56 h-56 sm:w-60 sm:h-60"
                          />
                          <div className="w-full sm:max-w-sm">
                            <div className="text-sm text-muted-foreground mb-2">{txt.scanHelp}</div>
                            <div className="text-xs break-all bg-muted/20 border rounded-lg p-2">
                              {qrPayload}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button className="bg-copper text-ink hover:bg-copperDark" onClick={tryOpenWallet}>{txt.openWallet}</Button>
                              <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(qrPayload); }}>{txt.copyCode}</Button>
                              <Button variant="secondary" onClick={() => load()}>{txt.refresh}</Button>
                              {showWebWallet && (
                                <Button variant="secondary" onClick={() => { window.open(String(tx?.checkoutUrl), '_blank'); }}>{txt.openWeb}</Button>
                              )}
                            </div>
                            {openMsg && (
                              <p className="text-xs text-yellow-600 mt-2">{txt.openFail}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{txt.desktopHint}</p>
                      </div>
                    )}

                    {tx?.status === 'failed' && (
                      <div className="text-red-600">{txt.failedNotice}</div>
                    )}
                    {tx?.status === 'cancelled' && (
                      <div className="text-yellow-600">{txt.cancelledNotice}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
