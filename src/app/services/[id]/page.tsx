"use client";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
  ExternalLink,
  Share2,
} from 'lucide-react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import MediaGallery from '@/components/media-gallery';
import StarRating from '@/components/star-rating';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getServiceById, updateService, type Service } from '@/lib/services';
import { findOrCreateConversation } from '@/lib/chat';
import ServiceMap from '@/components/service-map';
import { listReviewsByService, getUserReviewForService, upsertReview, deleteMyReview, type Review } from '@/lib/reviews';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getClientLocale, tr } from '@/lib/i18n';
import { getAuth } from 'firebase/auth';

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = getClientLocale();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState<number>(0);
  const [myText, setMyText] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = (params as any)?.id as string | string[] | undefined;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    // Support demo detail pages for mock cards like /services/demo-1
    if (id.startsWith('demo-')) {
      const numeric = parseInt(id.replace('demo-', ''), 10) || 1;
      const demo: Service = {
        id,
        title:
          numeric === 1
            ? 'Professional Plumbing Repairs & Installation'
            : numeric === 2
            ? 'Full House Cleaning Service'
            : numeric === 3
            ? 'Expert Car Mechanic for All Brands'
            : 'Private Math & Science Tutoring',
        description:
          'This is a demo service. Create a real service from your dashboard to replace demo content with your own details and images.',
        price: numeric === 2 ? 250 : numeric === 3 ? 200 : 150,
        category:
          numeric === 1
            ? 'Plumbing'
            : numeric === 2
            ? 'Home Services'
            : numeric === 3
            ? 'Automotive'
            : 'Education',
        city: numeric === 2 ? 'Benghazi' : numeric === 3 ? 'Misrata' : 'Tripoli',
        area: 'City Center',
        availabilityNote: 'Available 9 AM – 6 PM',
        images: [
          { url: 'https://placehold.co/800x600.png', hint: 'demo image' },
          { url: 'https://placehold.co/800x600.png', hint: 'demo image' },
        ],
        contactPhone: undefined,
        contactWhatsapp: undefined,
        providerId: 'demo',
        createdAt: undefined,
      };
      setService(demo);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const doc = await getServiceById(id);
        if (!doc) {
          setNotFound(true);
        } else {
          setService(doc);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  // no-op: carousel replaced by MediaGallery

  const whatsappLink = useMemo(() => {
    const number = (service as any)?.contactWhatsapp || (service as any)?.contactPhone;
    if (!service || !number) return null;
    const normalized = String(number).replace(/\+/g, '');
    return `https://wa.me/${normalized}?text=${encodeURIComponent(
      `Hello, I'm interested in your '${service.title}' service.`
    )}`;
  }, [service]);

  const [startingChat, setStartingChat] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function handleChat() {
    if (!service) return;
    if (service.providerId === 'demo') return;
    if (!user) {
      // Ask user to sign in then come back
      toast({ variant: 'destructive', title: tr(locale, 'chat.signInPrompt') });
      router.push('/login');
      return;
    }
    try {
      setStartingChat(true);
      const convId = await findOrCreateConversation(service.id!, service.providerId, user.uid);
      // Navigate to dedicated chat page
      router.push(`/messages/${convId}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('chat start failed', e);
      toast({ variant: 'destructive', title: 'Could not start chat' });
    } finally {
      setStartingChat(false);
    }
  }

  async function handleRequestService() {
    if (!service) return;
    if (service.providerId === 'demo') return;
    if (!user) {
      toast({ variant: 'destructive', title: tr(locale, 'form.toasts.pleaseSignInTitle'), description: tr(locale, 'form.toasts.pleaseSignInDesc') });
      router.push('/login');
      return;
    }
    try {
      setRequesting(true);
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('auth');
      const res = await fetch('/api/request/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ serviceId: service.id }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'request_failed');
      toast({ title: tr(locale, 'details.requestSent') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr(locale, 'details.requestFailed') });
    } finally {
      setRequesting(false);
    }
  }

  async function handleShare() {
    if (!service) return;
    try {
      setSharing(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/?ref=${service.providerId}`;
      let shared = false;
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          await (navigator as any).share({
            title: 'Khidmaty Connect',
            text: 'Discover local services on Khidmaty Connect',
            url,
          });
          shared = true;
        } catch {}
      }
      if (!shared && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      if (isOwner && service.id) {
        const nextCount = ((service as any).shareCount ?? 0) + 1;
        const nextPriority = Math.min(5, (((service as any).priority ?? 0) + 1));
        await updateService(service.id, { shareCount: nextCount, priority: nextPriority });
        setService({ ...(service as any), shareCount: nextCount, priority: nextPriority });
      }
      toast({ title: 'Share link ready', description: (shared ? 'Thanks for sharing!' : 'Link copied to clipboard.') });
    } catch {
      toast({ variant: 'destructive', title: 'Share failed' });
    } finally {
      setSharing(false);
    }
  }

  // Load reviews once service is ready (skip for demo services)
  useEffect(() => {
    (async () => {
      if (!service || service.providerId === 'demo') return;
      try {
        const list = await listReviewsByService(service.id!);
        setReviews(list);
      } catch {}
    })();
  }, [service?.id]);

  // Load my review if signed in
  useEffect(() => {
    (async () => {
      if (!service || !user || service.providerId === 'demo') return;
      try {
        const mine = await getUserReviewForService(service.id!, user.uid);
        if (mine) {
          setMyRating(mine.rating || 0);
          setMyText(mine.text || '');
        } else {
          setMyRating(0);
          setMyText('');
        }
      } catch {}
    })();
  }, [service?.id, user?.uid]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  const subservicesList = useMemo(() => {
    const arr = (service as any)?.subservices;
    return Array.isArray(arr) ? arr : [];
  }, [service?.subservices]);

  const subservicesTotal = useMemo(() => {
    return subservicesList.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
  }, [subservicesList]);

  const isOwner = useMemo(() => {
    return !!(user && service && service.providerId === user.uid);
  }, [user?.uid, service?.providerId]);

  // Determine whether to hide price on this page (explicit URL params only)
  const hidePrice = useMemo(() => {
    try {
      return !!(searchParams?.get('hidePrice') || searchParams?.get('noPrice'));
    } catch {}
    return false;
  }, [searchParams]);

  // DEBUG: log owner check when service/user changes
  useEffect(() => {
    if (service && user) {
      // eslint-disable-next-line no-console
      console.log('[reviews] owner check', {
        serviceId: service.id,
        providerId: service.providerId,
        myUid: user.uid,
        isOwner,
      });
    }
  }, [service?.id, user?.uid, isOwner]);

  // Track a view when the service loads (skip demo services)
  useEffect(() => {
    if (!service || !service.id || service.providerId === 'demo') return;
    const controller = new AbortController();
    const ref = typeof document !== 'undefined' ? document.referrer || null : null;
    const city = service.city || null;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service_view', serviceId: service.id, city, ref }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [service?.id]);

  async function handleSaveReview() {
    if (!service || !user) return;
    if (service.providerId === 'demo') {
      toast({ variant: 'destructive', title: 'Reviews are disabled for demo services.' });
      return;
    }
    // DEBUG: log attempt details
    // eslint-disable-next-line no-console
    console.log('[reviews] attempt save', {
      serviceId: service.id,
      providerId: service.providerId,
      myUid: user.uid,
      myRating,
      myTextLen: myText.length,
    });
    if (myRating < 1) {
      toast({ variant: 'destructive', title: tr(locale, 'reviews.toasts.requiredRating') });
      return;
    }
    try {
      setSaving(true);
      await upsertReview({ serviceId: service.id!, authorId: user.uid, rating: myRating, text: myText.slice(0, 1000) });
      // Refresh list and my state
      const list = await listReviewsByService(service.id!);
      setReviews(list);
      toast({ title: tr(locale, 'reviews.toasts.saved') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr(locale, 'reviews.toasts.saveFailed'), description: e?.message || '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReview() {
    if (!service || !user) return;
    if (service.providerId === 'demo') {
      toast({ variant: 'destructive', title: 'Reviews are disabled for demo services.' });
      return;
    }
    try {
      setSaving(true);
      await deleteMyReview(service.id!, user.uid);
      const list = await listReviewsByService(service.id!);
      setReviews(list);
      setMyRating(0);
      setMyText('');
      toast({ title: tr(locale, 'reviews.toasts.deleted') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr(locale, 'reviews.toasts.deleteFailed'), description: e?.message || '' });
    } finally {
      setSaving(false);
    }
  }

  const coords = useMemo(() => {
    if (service?.lat != null && service?.lng != null) {
      return { lat: Number(service.lat), lng: Number(service.lng) };
    }
    if (!service?.city) return null as null | { lat: number; lng: number };
    const city = (service.city || '').toLowerCase();
    // Approximate centroids for major Libyan cities used in the app
    if (city === 'tripoli') return { lat: 32.8872, lng: 13.1913 };
    if (city === 'benghazi') return { lat: 32.1167, lng: 20.0667 };
    if (city === 'misrata') return { lat: 32.3783, lng: 15.0906 };
    return null;
  }, [service?.city, service?.lat, service?.lng]);

  // Build a privacy-friendly YouTube embed URL if provided
  const videoEmbedUrl = useMemo(() => {
    const raw = (service as any)?.videoUrl as string | undefined;
    const conv = (rawStr: string | undefined) => {
      if (!rawStr) return null;
      try {
        const url = new URL(rawStr);
        const host = url.hostname.toLowerCase();
        let id: string | null = null;
        if (host.includes('youtube.com')) {
          const v = url.searchParams.get('v');
          if (v) id = v;
          if (!id && url.pathname.startsWith('/embed/')) id = url.pathname.split('/embed/')[1]?.split(/[?&]/)[0] ?? null;
          if (!id && url.pathname.startsWith('/shorts/')) id = url.pathname.split('/shorts/')[1]?.split(/[?&]/)[0] ?? null;
        } else if (host.includes('youtu.be')) {
          id = url.pathname.replace(/^\//, '').split(/[?&]/)[0] || null;
        }
        if (!id) return null;
        const t = url.searchParams.get('t') || url.searchParams.get('start') || undefined;
        let start: number | undefined = undefined;
        if (t) {
          const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?|(\d+)/);
          if (m) {
            if (m[4]) start = parseInt(m[4], 10);
            else {
              const h = m[1] ? parseInt(m[1], 10) : 0;
              const mm = m[2] ? parseInt(m[2], 10) : 0;
              const ss = m[3] ? parseInt(m[3], 10) : 0;
              start = h * 3600 + mm * 60 + ss;
            }
          }
        }
        const base = `https://www.youtube-nocookie.com/embed/${id}`;
        return start && start > 0 ? `${base}?start=${start}` : base;
      } catch { return null; }
    };
    return conv(raw);
  }, [service?.videoUrl]);

  const videoEmbedUrls = useMemo(() => {
    const arr = (((service as any)?.videoUrls as string[] | undefined) || []).filter(Boolean);
    const out: string[] = [];
    for (const raw of arr) {
      try {
        const url = new URL(raw);
        const host = url.hostname.toLowerCase();
        let id: string | null = null;
        if (host.includes('youtube.com')) {
          const v = url.searchParams.get('v');
          if (v) id = v;
          if (!id && url.pathname.startsWith('/embed/')) id = url.pathname.split('/embed/')[1]?.split(/[?&]/)[0] ?? null;
          if (!id && url.pathname.startsWith('/shorts/')) id = url.pathname.split('/shorts/')[1]?.split(/[?&]/)[0] ?? null;
        } else if (host.includes('youtu.be')) {
          id = url.pathname.replace(/^\//, '').split(/[?&]/)[0] || null;
        }
        if (!id) continue;
        const t = url.searchParams.get('t') || url.searchParams.get('start') || undefined;
        let start: number | undefined = undefined;
        if (t) {
          const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?|(\d+)/);
          if (m) {
            if (m[4]) start = parseInt(m[4], 10);
            else {
              const h = m[1] ? parseInt(m[1], 10) : 0;
              const mm = m[2] ? parseInt(m[2], 10) : 0;
              const ss = m[3] ? parseInt(m[3], 10) : 0;
              start = h * 3600 + mm * 60 + ss;
            }
          }
        }
        const base = `https://www.youtube-nocookie.com/embed/${id}`;
        out.push(start && start > 0 ? `${base}?start=${start}` : base);
      } catch {}
    }
    return out;
  }, [service?.videoUrls]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-12 md:py-16">
        <div className="container grid gap-8 md:grid-cols-3 lg:gap-12">
          {loading && (
            <div className="md:col-span-3 text-center text-muted-foreground">{tr(locale, 'details.loading')}</div>
          )}
          {!loading && (notFound || error) && (
            <div className="md:col-span-3 text-center">
              <h2 className="mb-2 text-2xl font-bold">{tr(locale, 'details.notFoundTitle')}</h2>
              <p className="mb-4 text-muted-foreground">
                {error ? tr(locale, 'details.notFoundBodyError') : tr(locale, 'details.notFoundBodyRemoved')}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/" className="underline">{tr(locale, 'details.goHome')}</Link>
                <Link href="/dashboard/services" className="underline">{tr(locale, 'details.backToMyServices')}</Link>
              </div>
            </div>
          )}
          {!loading && service && (
          <>
          <div className="md:col-span-2">
            <MediaGallery
              title={service.title}
              images={service.images || []}
              videoEmbedUrl={videoEmbedUrl}
              videoEmbedUrls={videoEmbedUrls}
            />

            <h1 className="mb-4 text-3xl font-bold font-headline md:text-4xl">
              {service.title}
            </h1>
            <div className="mb-6 flex flex-wrap items-center gap-4 text-muted-foreground">
              <Badge variant="secondary" className="text-base">
                {tr(locale, `categories.${service.category}`)}
              </Badge>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-5 w-5" />
                <span>
                  {service.city}, {service.area}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <StarRating value={Math.round(avgRating)} readOnly size="md" />
                <span className="text-sm">({reviews.length})</span>
              </div>
            </div>

            <h2 className="border-t pt-6 text-2xl font-bold font-headline mb-3">
              {tr(locale, 'details.description')}
            </h2>
            <p className="whitespace-pre-wrap text-lg text-foreground/80">
              {service.description}
            </p>

            <h2 className="mt-6 border-t pt-6 text-2xl font-bold font-headline mb-3">
              {tr(locale, 'details.availability')}
            </h2>
            <div className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <p>{service.availabilityNote}</p>
            </div>

            {subservicesList.length > 0 && (
              <>
                <h2 className="mt-6 border-t pt-6 text-2xl font-bold font-headline mb-3">Sub-services</h2>
                <div className="rounded border bg-background p-3">
                  <ul className="space-y-2">
                    {subservicesList.map((s: any) => (
                      <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium">
                            {s.title}{' '}
                            {s.unit ? <span className="text-muted-foreground">({s.unit})</span> : null}
                          </div>
                          {s.description ? (
                            <div className="text-muted-foreground">{s.description}</div>
                          ) : null}
                        </div>
                        {!hidePrice && (
                          <div className="whitespace-nowrap font-semibold">LYD {Number(s.price ?? 0)}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!hidePrice && (
                    <div className="mt-3 flex items-center justify-end text-sm">
                      <span className="text-muted-foreground mr-2">Total</span>
                      <span className="font-semibold">LYD {subservicesTotal}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {coords && (
              <>
                <h2 className="mt-6 border-t pt-6 text-2xl font-bold font-headline mb-3">
                  {tr(locale, 'details.location')}
                </h2>
                <div className="space-y-3">
                  <div className="text-muted-foreground">
                    {tr(locale, 'details.approxIn')} {service.city}
                    {service.area ? `, ${service.area}` : ''}.
                  </div>
                  {(service as any)?.mapUrl && (
                    <div>
                      <a
                        className="underline inline-flex items-center gap-2"
                        href={(service as any).mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {tr(locale, 'details.viewOnMap')}
                      </a>
                    </div>
                  )}
                  <ServiceMap
                    lat={coords.lat}
                    lng={coords.lng}
                    title={service.title}
                    city={service.city}
                    area={service.area}
                  />
                </div>
              </>
            )}

            {/* Reviews & Ratings */}
            <h2 id="reviews" className="scroll-mt-24 mt-6 border-t pt-6 text-2xl font-bold font-headline mb-3">
              {tr(locale, 'details.reviews')}
            </h2>
            <div className="mb-3 flex items-center gap-3">
              <StarRating value={Math.round(avgRating)} readOnly size="lg" />
              <span className="text-sm text-muted-foreground">({reviews.length})</span>
            </div>
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((r, idx) => (
                  <div key={r.id || idx} className="rounded border bg-background p-3">
                    <StarRating value={r.rating || 0} readOnly size="sm" />
                    {r.text ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{r.text}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tr(locale, 'reviews.empty')}</p>
            )}

            {/* Review form */}
            <div className="mt-4">
              {isOwner ? (
                <p className="text-sm text-muted-foreground">{tr(locale, 'reviews.ownerBlocked')}</p>
              ) : service.providerId === 'demo' ? (
                <p className="text-sm text-muted-foreground">Reviews are disabled for demo services.</p>
              ) : (
                <div className="rounded border bg-background p-4">
                  <label className="mb-2 block text-sm font-medium">{tr(locale, 'reviews.ratingLabel')}</label>
                  <StarRating value={myRating} onChange={user ? setMyRating : undefined} size="lg" />
                  {!user && (
                    <p className="mt-2 text-xs text-muted-foreground">{tr(locale, 'reviews.signInPrompt')}</p>
                  )}
                  <label className="mb-2 mt-4 block text-sm font-medium">{tr(locale, 'reviews.writeReview')}</label>
                  <Textarea
                    value={myText}
                    onChange={(e) => user && setMyText(e.target.value)}
                    placeholder={tr(locale, 'reviews.placeholder')}
                    className="min-h-[100px]"
                    disabled={!user}
                  />
                  <div className="mt-3 flex gap-2">
                    {user ? (
                      <>
                        <Button onClick={handleSaveReview} disabled={saving}>
                          {tr(locale, myRating > 0 ? 'reviews.update' : 'reviews.submit')}
                        </Button>
                        {reviews.some((r) => r.id === user.uid || (r as any).authorId === user.uid) && (
                          <Button variant="outline" onClick={handleDeleteReview} disabled={saving}>
                            {tr(locale, 'reviews.delete')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button asChild>
                        <Link href="/login">{tr(locale, 'header.login')}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-1">
            <Card className="sticky top-24">
              {!hidePrice && (
                <CardHeader>
                  <CardTitle className="text-center text-muted-foreground">
                    {tr(locale, 'details.servicePrice')}
                  </CardTitle>
                  <p className="text-center text-4xl font-bold text-primary">
                    {service.price} LYD
                  </p>
                </CardHeader>
              )}
              <CardContent className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="h-12 w-full text-lg"
                  onClick={handleShare}
                  disabled={sharing}
                >
                  <Share2 className="mr-2" /> {isOwner ? 'Share app (boost your service)' : 'Share this service'}
                </Button>
                {service.providerId !== 'demo' && !isOwner && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full text-lg"
                    onClick={handleRequestService}
                    disabled={requesting}
                  >
                    {tr(locale, 'details.requestService')}
                  </Button>
                )}
                {subservicesList.length > 0 && (
                  <div className="rounded border bg-background p-3">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Sub-services</div>
                    <ul className="space-y-1">
                      {subservicesList.slice(0, 3).map((s: any) => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">
                            {s.title}
                            {s.unit ? <span className="text-muted-foreground"> ({s.unit})</span> : null}
                          </span>
                          {!hidePrice && (
                            <span className="whitespace-nowrap font-medium">LYD {Number(s.price ?? 0)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {subservicesList.length > 3 && (
                      <Accordion type="single" collapsible className="mt-2">
                        <AccordionItem value="all">
                          <AccordionTrigger className="text-sm">Show all {subservicesList.length} items</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-1">
                              {subservicesList.slice(3).map((s: any) => (
                                <li key={s.id} className="flex items-center justify-between text-sm">
                                  <span className="truncate">
                                    {s.title}
                                    {s.unit ? <span className="text-muted-foreground"> ({s.unit})</span> : null}
                                  </span>
                                  {!hidePrice && (
                                    <span className="whitespace-nowrap font-medium">LYD {Number(s.price ?? 0)}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                    {!hidePrice && (
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">LYD {subservicesTotal}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Social links */}
                {((service as any)?.facebookUrl || (service as any)?.telegramUrl) && (
                  <div className="rounded border bg-background p-3">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Social</div>
                    <div className="flex flex-col gap-2 text-sm">
                      {(service as any)?.facebookUrl && (
                        <a className="underline inline-flex items-center gap-2" href={(service as any).facebookUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4"/>
                          Facebook
                        </a>
                      )}
                      {(service as any)?.telegramUrl && (
                        <a className="underline inline-flex items-center gap-2" href={(service as any).telegramUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4"/>
                          Telegram
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {((service as any)?.contactWhatsapp || (service as any)?.contactPhone) ? (
                  <>
                    {/* In-app chat: visible for signed-in non-owners and non-demo services */}
                    {service.providerId !== 'demo' && !isOwner && (
                      <Button size="lg" className="h-12 w-full text-lg" onClick={handleChat} disabled={startingChat}>
                        {tr(locale, 'details.chatInApp')}
                      </Button>
                    )}
                    <Button asChild size="lg" className="h-12 w-full bg-green-500 text-lg text-white hover:bg-green-600">
                      <a
                        href={whatsappLink ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (!service?.id) return;
                          const ref = typeof document !== 'undefined' ? document.referrer || null : null;
                          const city = service?.city || null;
                          fetch('/api/track', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'cta_click', serviceId: service.id, city, ref }),
                          }).catch(() => {});
                        }}
                      >
                        <MessageCircle className="mr-2" />
                        {tr(locale, 'details.contactWhatsApp')}
                      </a>
                    </Button>
                    {(service as any)?.contactPhone && (
                      <Button asChild size="lg" variant="outline" className="h-12 w-full text-lg">
                        <a
                          href={`tel:${(service as any).contactPhone}`}
                          onClick={() => {
                            if (!service?.id) return;
                            const ref = typeof document !== 'undefined' ? document.referrer || null : null;
                            const city = service?.city || null;
                            fetch('/api/track', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ type: 'cta_click', serviceId: service.id, city, ref }),
                            }).catch(() => {});
                          }}
                        >
                          <Phone className="mr-2" />
                          {tr(locale, 'details.callProvider')}
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    {tr(locale, 'details.noContact')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
