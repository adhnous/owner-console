'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { serviceSchema, type ServiceFormData } from '@/lib/schemas';
import { libyanCities, cityLabel, cityCenter } from '@/lib/cities';
import { useState, useTransition, useCallback, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import { Sparkles, Loader2, UploadCloud } from 'lucide-react';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { createService, uploadServiceImages, type ServiceImage } from '@/lib/services';
import AddressSearch from '@/components/address-search';
import { reverseGeocodeNominatim, getLangFromDocument } from '@/lib/geocode';
import { getClientLocale, tr } from '@/lib/i18n';
import { tileUrl, tileAttribution, markerHtml } from '@/lib/map';
import { categories } from '@/lib/categories';
import { Switch } from '@/components/ui/switch';

// Client-only react-leaflet components
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false }) as any;
const ScaleControl = dynamic(() => import('react-leaflet').then((m) => m.ScaleControl), { ssr: false }) as any;

// Helper: convert File to data URL
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Cloudinary upload helper (unsigned preset)
async function uploadImagesCloudinary(files: File[]): Promise<ServiceImage[]> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
  if (!cloudName || !preset) {
    throw new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_PRESET.');
  }
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
  const results: ServiceImage[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    // Optional: place inside a folder. Comment out or customize as needed.
    // fd.append('folder', 'khidmaty/services');
    const res = await fetch(endpoint, { method: 'POST', body: fd });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Cloudinary upload failed');
    }
    const data = await res.json();
    const url: string = data.secure_url || data.url;
    if (!url) throw new Error('Cloudinary did not return a URL');
    const publicId: string | undefined = data.public_id;
    results.push({ url, ...(publicId ? { publicId } : {}) });
  }
  return results;
}

// Local upload helper: POST images to our local API and receive URLs in /uploads
async function uploadImagesLocal(files: File[]): Promise<ServiceImage[]> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/uploads', { method: 'POST', body: fd });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'Local upload failed');
  }
  const data = (await res.json()) as { urls: string[] };
  return (data.urls || []).map((u) => ({ url: u }));
}

// Helper: compress an image to a JPEG data URL for lightweight inline storage
async function compressToDataUrl(file: File, maxWidth = 800, quality = 0.6): Promise<string> {
  const raw = await fileToDataUrl(file);
  const img = document.createElement('img');
  await new Promise((res, rej) => {
    img.onload = () => res(null);
    img.onerror = rej;
    img.src = raw;
  });
  const scale = Math.min(1, maxWidth / (img.width || maxWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((img.width || maxWidth) * scale);
  canvas.height = Math.round((img.height || maxWidth) * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function apiImproveServiceTitle(args: { title: string; description: string; category: string }) {
  const res = await fetch('/api/ai/improve-title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'AI request failed');
  }
  return (await res.json()) as { improvedTitle: string };
}

async function apiAutoCategorizeService(args: { description: string }) {
  const res = await fetch('/api/ai/auto-categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'AI request failed');
  }
  return (await res.json()) as { categorySuggestions: string[] };
}

export function ServiceForm() {
  const locale = getClientLocale();
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  
  // Only providers can access the service creation form
  if (loading) return null;
  if (userProfile?.role !== 'provider') {
    return (
      <div className="rounded border bg-background p-4 text-sm text-muted-foreground">
        This page is for provider accounts only.
      </div>
    );
  }
  const [isImprovingTitle, startImprovingTitleTransition] = useTransition();
  const [isCategorizing, startCategorizingTransition] = useTransition();
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const debounceTimeout = useRef<NodeJS.Timeout>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [autoPrice, setAutoPrice] = useState(true);

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      category: '',
      city: 'Tripoli',
      area: '',
      availabilityNote: '',
      contactPhone: '',
      contactWhatsapp: '',
      mapUrl: '',
      videoUrl: '',
      videoUrls: [],
      facebookUrl: '',
      telegramUrl: '',
      subservices: [],
      // Default to Tripoli center
      lat: 32.8872 as any,
      lng: 13.1913 as any,
    },
  });

  // Watch location fields (after form is created)
  const lat = form.watch('lat') as number | undefined;
  const lng = form.watch('lng') as number | undefined;
  const cityWatch = form.watch('city');
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const selectedCityCenter = useMemo(() => cityCenter(String(cityWatch || '')), [cityWatch]);

  // Ensure numeric values for map and formatting (watchers may be strings)
  const latNum =
    typeof lat === 'number'
      ? lat
      : (lat as any) == null || (lat as any) === '' || isNaN(Number(lat as any))
        ? undefined
        : Number(lat as any);
  const lngNum =
    typeof lng === 'number'
      ? lng
      : (lng as any) == null || (lng as any) === '' || isNaN(Number(lng as any))
        ? undefined
        : Number(lng as any);

  const gmapsUrl = useMemo(() => (
    latNum != null && lngNum != null
      ? `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`
      : null
  ), [latNum, lngNum]);
  const appleMapsUrl = useMemo(() => (
    latNum != null && lngNum != null
      ? `http://maps.apple.com/?q=${latNum},${lngNum}`
      : null
  ), [latNum, lngNum]);
  const geoUrl = useMemo(() => (
    latNum != null && lngNum != null
      ? `geo:${latNum},${lngNum}?q=${latNum},${lngNum}`
      : null
  ), [latNum, lngNum]);

  useEffect(() => {
    setMapMounted(true);
  }, []);

  // Reverse geocode with caching + abort
  useEffect(() => {
    if (latNum == null || lngNum == null) { setSelectedAddress(''); return; }
    const ac = new AbortController();
    const lang = getLangFromDocument();
    reverseGeocodeNominatim(latNum, lngNum, lang, ac.signal)
      .then((r) => setSelectedAddress(r.displayName))
      .catch((e) => {
        if ((e as any)?.name === 'AbortError') return;
        setSelectedAddress('');
      });
    return () => ac.abort();
  }, [latNum, lngNum]);

  // Leaflet marker icon (div-based to avoid asset issues)
  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: markerHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  // Dynamic sub-services
  const subFieldArray = useFieldArray({ control: form.control, name: 'subservices' });
  const subWatch = form.watch('subservices') as any[] | undefined;
  const subTotal = (subWatch || []).reduce((sum, s) => sum + (Number(s?.price) || 0), 0);
  // Additional YouTube links managed via watch/setValue

  // Keep main price in sync with sub-services total when auto pricing is on
  useEffect(() => {
    if (!autoPrice) return;
    form.setValue('price', Number.isFinite(subTotal) ? Number(subTotal) : 0, {
      shouldValidate: true,
    });
  }, [subTotal, autoPrice]);

  function handleUseMyLocation() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast({ variant: 'destructive', title: tr(locale, 'form.geo.notAvailableTitle'), description: tr(locale, 'form.geo.notAvailableDesc') });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos.coords.latitude.toFixed(6));
        const ln = Number(pos.coords.longitude.toFixed(6));
        form.setValue('lat', la, { shouldValidate: true });
        form.setValue('lng', ln, { shouldValidate: true });
        toast({ title: tr(locale, 'form.geo.setTitle'), description: `${la}, ${ln}` });
      },
      (err) => {
        toast({ variant: 'destructive', title: tr(locale, 'form.geo.couldNotGetTitle'), description: err?.message || tr(locale, 'form.geo.couldNotGetDesc') });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // (attached via MapContainer.whenCreated below) keep form lat/lng synced to map center on zoom/pan

  const handleImproveTitle = async () => {
    const { title, description, category } = form.getValues();
    if (!title || !description || !category) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description:
          'Please fill in title, description, and category to improve the title.',
      });
      return;
    }
    startImprovingTitleTransition(async () => {
      try {
        const result = await apiImproveServiceTitle({
          title,
          description,
          category,
        });
        form.setValue('title', result.improvedTitle, { shouldValidate: true });
        toast({
          title: tr(locale, 'form.toasts.aiTitleImproved'),
          description: tr(locale, 'form.toasts.aiSuggested'),
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: tr(locale, 'form.toasts.aiErrorTitle'),
          description: tr(locale, 'form.toasts.aiErrorDesc'),
        });
      }
    });
  };

  const handleAutoCategory = useCallback(() => {
    const description = form.getValues('description');
    if (description.length < 50) return;

    startCategorizingTransition(async () => {
      try {
        const result = await apiAutoCategorizeService({ description });
        setCategorySuggestions(result.categorySuggestions);
      } catch (error) {
        console.error('Could not get category suggestions', error);
      }
    });
  }, [form]);

  const onDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    field.onChange(e);
    clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      handleAutoCategory();
    }, 1000);
  };
  
  const { ref, ...field } = form.register('description');

  async function onSubmit(data: ServiceFormData) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: tr(locale, 'form.toasts.pleaseSignInTitle'),
        description: tr(locale, 'form.toasts.pleaseSignInDesc'),
      });
      router.push('/login');
      return;
    }

    setSubmitting(true);
    try {
      let images: ServiceImage[] = [];
      if (selectedFiles.length > 0) {
        const mode = (process.env.NEXT_PUBLIC_IMAGE_UPLOAD_MODE || '').toLowerCase();
        try {
          if (mode === 'local') {
            images = await uploadImagesLocal(selectedFiles);
          } else if (mode === 'cloudinary') {
            images = await uploadImagesCloudinary(selectedFiles);
          } else if (
            mode === 'inline' ||
            process.env.NEXT_PUBLIC_DISABLE_STORAGE_UPLOAD === '1' ||
            process.env.NEXT_PUBLIC_DISABLE_STORAGE_UPLOAD === 'true'
          ) {
            const limited = selectedFiles.slice(0, 2);
            const dataUrls = await Promise.all(
              limited.map((f) => compressToDataUrl(f, 800, 0.6))
            );
            images = dataUrls.map((u: string) => ({ url: u }));
          } else {
            images = await uploadServiceImages(user.uid, selectedFiles);
          }
        } catch (err: any) {
          console.error('Image upload failed', err);
          toast({
            title: tr(locale, 'form.toasts.imageUploadFailed'),
            description:
              mode === 'local'
                ? 'Local upload failed — please try again.'
                : 'Saving compressed copies temporarily. You can re-upload later.',
          });
          if (mode !== 'local') {
            const limited = selectedFiles.slice(0, 2);
            const dataUrls = await Promise.all(
              limited.map((f) => compressToDataUrl(f, 800, 0.6))
            );
            images = dataUrls.map((u: string) => ({ url: u }));
          }
        }
      }

      const providerName = userProfile?.displayName || user.displayName || (user.email ? user.email.split('@')[0] : null);
      const providerEmail = user.email || null;

      const serviceId = await createService({
        title: data.title,
        description: data.description,
        price: data.price,
        category: data.category,
        city: data.city,
        area: data.area,
        ...(data.lat != null ? { lat: data.lat } : {}),
        ...(data.lng != null ? { lng: data.lng } : {}),
        ...(data.mapUrl && data.mapUrl.trim() ? { mapUrl: data.mapUrl.trim() } : {}),
        availabilityNote: data.availabilityNote,
        contactPhone: data.contactPhone,
        contactWhatsapp: data.contactWhatsapp,
        ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
        ...(Array.isArray(data.videoUrls) && data.videoUrls.filter(Boolean).length > 0
          ? { videoUrls: data.videoUrls.filter((u) => typeof u === 'string' && u.trim() !== '') }
          : {}),
        ...(data.facebookUrl && data.facebookUrl.trim() ? { facebookUrl: data.facebookUrl.trim() } : {}),
        ...(data.telegramUrl && data.telegramUrl.trim() ? { telegramUrl: data.telegramUrl.trim() } : {}),
        images,
        providerId: user.uid,
        providerName,
        providerEmail,
        subservices: data.subservices ?? [],
      });

      toast({
        title: tr(locale, 'form.toasts.createdTitle'),
        description: tr(locale, 'form.toasts.createdDesc'),
      });
      router.push(`/services/${serviceId}`);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: tr(locale, 'form.toasts.createFailedTitle'),
        description: error?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tr(locale, 'form.labels.title')}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    placeholder={tr(locale, 'form.placeholders.title')}
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImproveTitle}
                  disabled={isImprovingTitle}
                  aria-label={tr(locale, 'form.actions.improve')}
                >
                  {isImprovingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {tr(locale, 'form.actions.improve')}
                </Button>
              </div>
        {/* Sub-services repeater */}
        <div className="space-y-3">
          <FormLabel>{tr(locale, 'form.subservices.label')}</FormLabel>
          <div className="space-y-3">
            {subFieldArray.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">{tr(locale, 'form.subservices.empty')}</p>
            )}
            {subFieldArray.fields.map((field, index) => (
              <div key={field.id} className="rounded border p-3 space-y-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <FormField
                    control={form.control}
                    name={`subservices.${index}.title` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr(locale, 'form.subservices.title')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`subservices.${index}.price` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr(locale, 'form.subservices.price')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="1" placeholder="50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`subservices.${index}.unit` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr(locale, 'form.subservices.unit')}</FormLabel>
                        <FormControl>
                          <Input placeholder={tr(locale, 'form.subservices.unitPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={() => subFieldArray.remove(index)}>
                      {tr(locale, 'form.subservices.remove')}
                    </Button>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name={`subservices.${index}.description` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tr(locale, 'form.subservices.description')}</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder={tr(locale, 'form.subservices.descriptionPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">{tr(locale, 'form.subservices.total')}</div>
              <div className="font-semibold">LYD {Number.isFinite(subTotal) ? subTotal : 0}</div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                subFieldArray.append({
                  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  title: '',
                  price: 0,
                  unit: '',
                  description: '',
                })
              }
            >
              + {tr(locale, 'form.subservices.add')}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleUseMyLocation}>{tr(locale, 'form.actions.useMyLocation')}</Button>
          <Button type="button" variant="outline" onClick={() => { form.setValue('lat', undefined as any); form.setValue('lng', undefined as any); }}>{tr(locale, 'form.actions.clearLocation')}</Button>
        </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={() => (
            <FormItem>
              <FormLabel>{tr(locale, 'form.labels.description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={tr(locale, 'form.placeholders.description')}
                  className="min-h-[150px]"
                  {...field}
                  ref={ref}
                  onChange={onDescriptionChange}
                />
              </FormControl>
              <FormDescription>
                {tr(locale, 'form.help.description')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.category')}</FormLabel>
                {useCustomCategory ? (
                  <>
                    <FormControl>
                      <Input
                        placeholder={locale === 'ar' ? 'اكتب فئة مخصصة' : 'Type a custom category'}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {locale === 'ar' ? 'سيتم حفظ الفئة المخصصة مع خدمتك.' : 'Your custom category will be saved with your service.'}
                    </FormDescription>
                    <div className="pt-1">
                      <Button type="button" variant="link" className="p-0" onClick={() => setUseCustomCategory(false)}>
                        {locale === 'ar' ? 'الرجوع إلى قائمة الفئات' : 'Back to category list'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Select
                      onValueChange={(v) => {
                        if (v === '__CUSTOM__') {
                          setUseCustomCategory(true);
                          form.setValue('category', '', { shouldValidate: true });
                          return;
                        }
                        field.onChange(v);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={tr(locale, 'form.labels.category')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {tr(locale, `categories.${cat}`)}
                          </SelectItem>
                        ))}
                        <SelectItem value="__CUSTOM__">
                          {locale === 'ar' ? 'إضافة فئة جديدة…' : 'Add new category…'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="pt-1">
                      <Button type="button" variant="link" className="p-0" onClick={() => setUseCustomCategory(true)}>
                        {locale === 'ar' ? 'لم تجد فئتك؟ اكتب فئة مخصصة' : "Can't find yours? Type a custom category"}
                      </Button>
                    </div>
                  </>
                )}
                {categorySuggestions.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      {isCategorizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {tr(locale, 'form.ai.suggestions')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {categorySuggestions.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20"
                          onClick={() =>
                            form.setValue('category', s, {
                              shouldValidate: true,
                            })
                          }
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.price')}</FormLabel>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{autoPrice ? tr(locale, 'form.subservices.autoCalc') : (locale === 'ar' ? 'سعر يدوي' : 'Manual price')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{autoPrice ? (locale === 'ar' ? 'تلقائي' : 'Auto') : (locale === 'ar' ? 'يدوي' : 'Manual')}</span>
                    <Switch checked={autoPrice} onCheckedChange={setAutoPrice} aria-label="Auto-calc from sub-services" />
                  </div>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="100"
                    readOnly={autoPrice}
                    value={field.value as any}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === '' ? (autoPrice ? 0 : '') : Number(v));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.city')}</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    const c = cityCenter(v);
                    if (c) {
                      form.setValue('lat', c.lat, { shouldValidate: true });
                      form.setValue('lng', c.lng, { shouldValidate: true });
                    }
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={tr(locale, 'home.cityPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {libyanCities.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {cityLabel(locale, c.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="area"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.area')}</FormLabel>
                <FormControl>
                  <Input placeholder={tr(locale, 'form.labels.area')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="lat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.latitude')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g., 32.8872"
                    value={(field.value as any) ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  If provided, the map on your service page will use this exact location.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lng"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.longitude')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g., 13.1913"
                    value={(field.value as any) ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <FormLabel>{tr(locale, 'form.labels.pickLocation')}</FormLabel>
          <AddressSearch
            className="max-w-md"
            placeholder={tr(locale, 'form.placeholders.searchAddress')}
            countryCodes="ly"
            city={String(cityWatch || '')}
            onSelect={({ lat, lng }) => {
              form.setValue('lat', Number(lat.toFixed(6)), { shouldValidate: true });
              form.setValue('lng', Number(lng.toFixed(6)), { shouldValidate: true });
            }}
          />
          {mapMounted && (
            <div className="relative h-64 w-full overflow-hidden rounded border">
              <MapContainer
                key={`${latNum ?? 'city'}-${lngNum ?? 'city'}-${cityWatch}`}
                center={(latNum != null && lngNum != null)
                  ? [latNum, lngNum]
                  : [selectedCityCenter?.lat ?? 32.8872, selectedCityCenter?.lng ?? 13.1913]}
                zoom={13}
                className="h-full w-full cursor-crosshair"
                scrollWheelZoom={true}
                whenReady={(e: any) => {
                  // Ensure Leaflet computes pane positions after mount/layout
                  setTimeout(() => e.target.invalidateSize(), 0);
                }}
                onClick={(e: any) => {
                  const { lat: la, lng: ln } = e.latlng || {};
                  if (typeof la === 'number' && typeof ln === 'number') {
                    form.setValue('lat', Number(la.toFixed(6)), { shouldValidate: true });
                    form.setValue('lng', Number(ln.toFixed(6)), { shouldValidate: true });
                  }
                }}
                whenCreated={(map: any) => {
                  const update = () => {
                    const c = map.getCenter();
                    form.setValue('lat', Number(c.lat.toFixed(6)), { shouldValidate: true });
                    form.setValue('lng', Number(c.lng.toFixed(6)), { shouldValidate: true });
                  };
                  map.on('moveend', update);
                  map.on('zoomend', update);
                }}
              >
                <TileLayer attribution={tileAttribution} url={tileUrl} />
                <ScaleControl position="bottomleft" />
                {(latNum != null && lngNum != null) && (
                  <Marker
                    position={[latNum, lngNum] as any}
                    draggable={true}
                    icon={markerIcon as any}
                    eventHandlers={{
                      dragend: (e: any) => {
                        const p = e.target.getLatLng();
                        form.setValue('lat', Number(p.lat.toFixed(6)), { shouldValidate: true });
                        form.setValue('lng', Number(p.lng.toFixed(6)), { shouldValidate: true });
                      },
                    }}
                  >
                    <Popup>{tr(locale, 'form.map.selected')}</Popup>
                  </Marker>
                )}
              </MapContainer>
              <div className="pointer-events-auto absolute bottom-2 right-2 flex gap-2">
                <a
                  className="rounded bg-background/80 px-2 py-1 text-xs underline shadow"
                  href={gmapsUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!gmapsUrl) e.preventDefault(); }}
                >
                  Google Maps
                </a>
                <a
                  className="rounded bg-background/80 px-2 py-1 text-xs underline shadow"
                  href={appleMapsUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!appleMapsUrl) e.preventDefault(); }}
                >
                  Apple Maps
                </a>
              </div>
            </div>
          )}
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {latNum != null && lngNum != null ? (
              <span>
                {tr(locale, 'form.map.selected')}: {latNum.toFixed(6)}, {lngNum.toFixed(6)}{selectedAddress ? ` — ${selectedAddress}` : ''}
                {` `}
                <a
                  className="underline"
                  href={`https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lngNum}#map=13/${latNum}/${lngNum}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr(locale, 'form.map.openInOSM')}
                </a>
                {` `}·{` `}
                <a
                  className="underline"
                  href={gmapsUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!gmapsUrl) e.preventDefault(); }}
                >
                  Google Maps
                </a>
                {` `}·{` `}
                <a
                  className="underline"
                  href={appleMapsUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!appleMapsUrl) e.preventDefault(); }}
                >
                  Apple Maps
                </a>
                {` `}·{` `}
                <a
                  className="underline"
                  href={geoUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { if (!geoUrl) e.preventDefault(); }}
                >
                  Open in Maps app
                </a>
              </span>
            ) : (
              <span>{tr(locale, 'form.map.clickToSet')}</span>
            )}
          </div>

          <FormField
            control={form.control}
            name="mapUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.mapUrl')}</FormLabel>
                <FormControl>
                  <Input placeholder="https://maps.google.com/?q=... or https://www.openstreetmap.org/..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="availabilityNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.availabilityNote')}</FormLabel>
                <FormControl>
                  <Input placeholder={tr(locale, 'form.placeholders.availability')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.contactPhone')}</FormLabel>
                <FormControl>
                  <Input placeholder={tr(locale, 'form.placeholders.contactPhone')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactWhatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.contactWhatsapp')}</FormLabel>
                <FormControl>
                  <Input placeholder={tr(locale, 'form.placeholders.contactWhatsapp')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tr(locale, 'form.labels.videoUrl')}</FormLabel>
              <FormControl>
                <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
              </FormControl>
              <FormDescription>{tr(locale, 'form.help.videoUrl')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Additional YouTube links */}
        <div className="space-y-2">
          <FormLabel>{tr(locale, 'form.labels.videoUrls')}</FormLabel>
          <div className="space-y-2">
            {(form.watch('videoUrls') || []).map((url, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={url}
                  onChange={(e) => {
                    const next = [...(form.getValues('videoUrls') || [])];
                    next[idx] = e.target.value;
                    form.setValue('videoUrls', next, { shouldValidate: true });
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const next = (form.getValues('videoUrls') || []).filter((_, i) => i !== idx);
                    form.setValue('videoUrls', next, { shouldValidate: true });
                  }}
                >
                  {tr(locale, 'form.subservices.remove')}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const v = newVideoUrl.trim();
                if (!v) return;
                const next = [...(form.getValues('videoUrls') || []), v];
                form.setValue('videoUrls', next, { shouldValidate: true });
                setNewVideoUrl('');
              }}
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Social links */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="facebookUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.facebookUrl')}</FormLabel>
                <FormControl>
                  <Input placeholder="https://facebook.com/yourpage" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telegramUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tr(locale, 'form.labels.telegramUrl')}</FormLabel>
                <FormControl>
                  <Input placeholder="https://t.me/yourchannel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormItem>
          <FormLabel>{tr(locale, 'form.images.label')}</FormLabel>
          <FormControl>
            <div className="flex w-full items-center justify-center">
              <label
                htmlFor="dropzone-file"
                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-secondary transition-colors hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground"/>
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">{tr(locale, 'form.actions.clickToUpload')}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr(locale, 'form.help.imageTypes')}
                  </p>
                </div>
                <Input
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setSelectedFiles(files.slice(0, 8));
                  }}
                />
              </label>
            </div>
          </FormControl>
          <FormDescription>
            {tr(locale, 'form.help.coverImage')}
          </FormDescription>
          {selectedFiles.length > 0 && (
            <div className="pt-2 text-sm text-muted-foreground">
              {tr(locale, 'form.images.selectedCount')
                .replace('{count}', String(selectedFiles.length))
                .replace('{names}', selectedFiles.map(f => f.name).join(', '))}
            </div>
          )}
        </FormItem>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr(locale, 'form.actions.createService')}
        </Button>
      </form>
    </Form>
  );
}
