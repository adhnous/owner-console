"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { deleteField } from 'firebase/firestore';
import L from 'leaflet';
import { useMapEvents } from 'react-leaflet';
import { reverseGeocodeNominatim, getLangFromDocument } from '@/lib/geocode';

import { getServiceById, updateService, type Service, type ServiceImage } from '@/lib/services';
import { serviceSchema } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import { getClientLocale, tr } from '@/lib/i18n';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import AddressSearch from '@/components/address-search';
import { libyanCities, cityLabel, cityCenter } from '@/lib/cities';

const EditSchema = serviceSchema; // reuse same fields

type EditFormData = z.infer<typeof EditSchema>;

// Client-only react-leaflet components to avoid double-init in dev
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false }) as any;
const ScaleControl = dynamic(() => import('react-leaflet').then((m) => m.ScaleControl), { ssr: false }) as any;

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const locale = getClientLocale();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<ServiceImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [mapMounted, setMapMounted] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const form = useForm<EditFormData>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      category: '',
      city: 'Tripoli',
      area: '',
      mapUrl: '',
      availabilityNote: '',
      contactPhone: '',
      contactWhatsapp: '',
      videoUrl: '',
      videoUrls: [],
      facebookUrl: '',
      telegramUrl: '',
      subservices: [],
    },
  });

  // Require sign-in to edit and load the service
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        variant: 'destructive',
        title: tr(locale, 'form.toasts.pleaseSignInTitle'),
        description: tr(locale, 'form.toasts.pleaseSignInDesc'),
      });
      router.push('/login');
      return;
    }
    (async () => {
      const id = params?.id;
      if (!id) return;
      const doc = await getServiceById(id);
      if (!doc) {
        router.push('/dashboard/services');
        return;
      }
      // Optional: Only allow the owner to edit
      if (user && (doc as Service).providerId && (doc as Service).providerId !== user.uid) {
        toast({
          variant: 'destructive',
          title: tr(locale, 'dashboard.serviceForm.notAllowedTitle'),
          description: tr(locale, 'dashboard.serviceForm.notAllowedDesc'),
        });
        router.push('/dashboard/services');
        return;
      }
      // Populate form with existing values
      form.reset({
        title: doc.title,
        description: doc.description,
        price: doc.price,
        category: doc.category,
        city: doc.city,
        area: doc.area,
        mapUrl: (doc as any).mapUrl ?? '',
        availabilityNote: doc.availabilityNote ?? '',
        contactPhone: (doc as any).contactPhone ?? '',
        contactWhatsapp: (doc as any).contactWhatsapp ?? '',
        videoUrl: (doc as any).videoUrl ?? '',
        videoUrls: Array.isArray((doc as any).videoUrls) ? (doc as any).videoUrls : [],
        facebookUrl: (doc as any).facebookUrl ?? '',
        telegramUrl: (doc as any).telegramUrl ?? '',
        subservices: (doc as any).subservices ?? [],
      });
      setImages(doc.images ?? []);
      // Default to Tripoli center if missing
      const latVal = (doc as any).lat;
      const lngVal = (doc as any).lng;
      if (typeof latVal === 'number' && typeof lngVal === 'number') {
        setLat(latVal);
        setLng(lngVal);
      } else {
        setLat(32.8872);
        setLng(13.1913);
      }
      setLoading(false);
    })();
  }, [authLoading, user, params, form, router, toast, locale]);

  useEffect(() => {
    setMapMounted(true);
  }, []);

  // Leaflet marker icon (div-based to avoid asset issues)
  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 0 2px rgba(0,0,0,0.15)"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  const tileUrl = process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttrib = process.env.NEXT_PUBLIC_OSM_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Sub-services editing
  const subFieldArray = useFieldArray({ control: form.control, name: 'subservices' as const });
  const subWatch = form.watch('subservices') as any[] | undefined;
  const subTotal = (subWatch || []).reduce((sum, s) => sum + (Number(s?.price) || 0), 0);

  // Keep price synced to subservices total
  useEffect(() => {
    form.setValue('price', Number.isFinite(subTotal) ? Number(subTotal) : 0, { shouldValidate: true });
  }, [subTotal]);

  // Reverse geocode selected point to show human-readable address (free, cached)
  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') { setSelectedAddress(''); return; }
    const ac = new AbortController();
    const lang = getLangFromDocument();
    reverseGeocodeNominatim(lat, lng, lang, ac.signal)
      .then((r) => setSelectedAddress(r.displayName))
      .catch((e) => {
        if ((e as any)?.name === 'AbortError') return;
        setSelectedAddress('');
      });
    return () => ac.abort();
  }, [lat, lng]);

  // Keep lat/lng synced to the map center when zooming or panning (edit form)
  function CenterWatcher() {
    const map: any = useMapEvents({
      zoomend() {
        const c = map.getCenter();
        setLat(Number(c.lat.toFixed(6)));
        setLng(Number(c.lng.toFixed(6)));
      },
      moveend() {
        const c = map.getCenter();
        setLat(Number(c.lat.toFixed(6)));
        setLng(Number(c.lng.toFixed(6)));
      },
    });
    return null;
  }

  // --- Image helpers (match create form modes) ---
  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

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

  async function uploadImagesLocal(files: File[]): Promise<ServiceImage[]> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { urls: string[] };
    return (data.urls || []).map((u) => ({ url: u }));
  }

  async function uploadImagesCloudinary(files: File[]): Promise<ServiceImage[]> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
    if (!cloudName || !preset) throw new Error('Cloudinary not configured');
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
    const out: ServiceImage[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', preset);
      const r = await fetch(endpoint, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const url: string = j.secure_url || j.url;
      const publicId: string | undefined = j.public_id;
      out.push({ url, ...(publicId ? { publicId } : {}) });
    }
    return out;
  }

  async function handleAddFiles(files: File[]) {
    if (files.length === 0) return;
    const mode = (process.env.NEXT_PUBLIC_IMAGE_UPLOAD_MODE || '').toLowerCase();
    try {
      let added: ServiceImage[] = [];
      if (mode === 'local') {
        added = await uploadImagesLocal(files);
      } else if (mode === 'cloudinary') {
        added = await uploadImagesCloudinary(files);
      } else {
        // inline fallback
        const limited = files.slice(0, 4);
        const dataUrls = await Promise.all(limited.map((f) => compressToDataUrl(f)));
        added = dataUrls.map((u) => ({ url: u }));
      }
      setImages((prev) => [...prev, ...added]);
      toast({ title: tr(locale, 'form.toasts.imagesAdded') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr(locale, 'form.toasts.addImagesFailed'), description: e?.message || '' });
    }
  }

  async function handleReplaceFile(index: number, file: File) {
    const mode = (process.env.NEXT_PUBLIC_IMAGE_UPLOAD_MODE || '').toLowerCase();
    try {
      let next: ServiceImage;
      if (mode === 'local') {
        const [img] = await uploadImagesLocal([file]);
        next = img;
      } else if (mode === 'cloudinary') {
        const [img] = await uploadImagesCloudinary([file]);
        next = img;
      } else {
        const url = await compressToDataUrl(file);
        next = { url };
      }
      setImages((prev) => prev.map((it, i) => (i === index ? next : it)));
      toast({ title: tr(locale, 'form.toasts.imageReplaced') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr(locale, 'form.toasts.replaceFailed'), description: e?.message || '' });
    }
  }

  function handleReplaceUrl(index: number) {
    const url = window.prompt(tr(locale, 'form.images.pasteUrlPlaceholder'));
    if (!url) return;
    setImages((prev) => prev.map((it, i) => (i === index ? { url } : it)));
    toast({ title: tr(locale, 'form.toasts.imageReplaced') });
  }

  function moveImage(index: number, delta: number) {
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddUrl() {
    const v = newImageUrl.trim();
    if (!v) return;
    setImages((prev) => [...prev, { url: v }]);
    setNewImageUrl('');
  }

  function handleUseMyLocation() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast({ variant: 'destructive', title: tr(locale, 'form.geo.notAvailableTitle'), description: tr(locale, 'form.geo.notAvailableDesc') });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos.coords.latitude.toFixed(6));
        const ln = Number(pos.coords.longitude.toFixed(6));
        setLat(la);
        setLng(ln);
        toast({ title: tr(locale, 'form.geo.setTitle'), description: `${la}, ${ln}` });
      },
      (err) => {
        toast({ variant: 'destructive', title: tr(locale, 'form.geo.couldNotGetTitle'), description: err?.message || tr(locale, 'form.geo.couldNotGetDesc') });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function onSubmit(data: EditFormData) {
    try {
      setSubmitting(true);
      const id = params?.id as string;
      const payload: any = {
        title: data.title,
        description: data.description,
        price: data.price,
        category: data.category,
        city: data.city,
        area: data.area,
        availabilityNote: data.availabilityNote,
        contactPhone: data.contactPhone,
        contactWhatsapp: data.contactWhatsapp,
        images,
        subservices: data.subservices ?? [],
      };
      // Handle optional coordinates: set values if present, otherwise delete fields
      if (typeof lat === 'number') payload.lat = lat; else payload.lat = deleteField();
      if (typeof lng === 'number') payload.lng = lng; else payload.lng = deleteField();
      if (typeof (data as any).mapUrl === 'string' && (data as any).mapUrl.trim()) payload.mapUrl = (data as any).mapUrl.trim(); else payload.mapUrl = deleteField();
      if (typeof data.videoUrl === 'string' && data.videoUrl.trim()) payload.videoUrl = data.videoUrl.trim(); else payload.videoUrl = deleteField();
      // Additional video links
      if (Array.isArray((data as any).videoUrls) && (data as any).videoUrls.filter(Boolean).length > 0) {
        payload.videoUrls = (data as any).videoUrls.filter((u: string) => typeof u === 'string' && u.trim() !== '');
      } else {
        payload.videoUrls = deleteField();
      }
      // Social links
      if ((data as any).facebookUrl && (data as any).facebookUrl.trim()) payload.facebookUrl = (data as any).facebookUrl.trim(); else payload.facebookUrl = deleteField();
      if ((data as any).telegramUrl && (data as any).telegramUrl.trim()) payload.telegramUrl = (data as any).telegramUrl.trim(); else payload.telegramUrl = deleteField();

      await updateService(id, payload);
      toast({ title: tr(locale, 'form.toasts.updateSuccess') });
      router.push(`/services/${id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: tr(locale, 'form.toasts.updateFailedTitle'), description: err?.message || '' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{tr(locale, 'dashboard.services.loading')}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{tr(locale, 'dashboard.serviceForm.editTitle')}</CardTitle>
          <CardDescription>{tr(locale, 'dashboard.serviceForm.editSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tr(locale, 'form.labels.title')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tr(locale, 'form.labels.description')}</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[150px]" {...field} />
                    </FormControl>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tr(locale, 'form.labels.category')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Plumbing','Home Services','Automotive','Education','Electrical','Carpentry','Gardening'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr(locale, 'form.labels.price')}</FormLabel>
                        <FormControl>
                          <Input type="number" readOnly {...field} />
                        </FormControl>
                        <FormDescription>{tr(locale, 'form.subservices.autoCalc')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Sub-services repeater */}
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

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tr(locale, 'form.labels.videoUrl')}</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Additional YouTube links */}
              <div className="space-y-2">
                <FormLabel>{tr(locale, 'form.labels.videoUrls')}</FormLabel>
                <div className="space-y-2">
                  {(form.watch('videoUrls') as any[] || []).map((url: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const next = [...((form.getValues('videoUrls') as any[]) || [])];
                          next[idx] = e.target.value;
                          form.setValue('videoUrls' as any, next, { shouldValidate: true });
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const next = ((form.getValues('videoUrls') as any[]) || []).filter((_, i) => i !== idx);
                          form.setValue('videoUrls' as any, next, { shouldValidate: true });
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
                    value={(form as any)._newVideoUrl || ''}
                    onChange={(e) => ((form as any)._newVideoUrl = e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = String((form as any)._newVideoUrl || '').trim();
                      if (!v) return;
                      const next = [...((form.getValues('videoUrls') as any[]) || []), v];
                      form.setValue('videoUrls' as any, next, { shouldValidate: true });
                      (form as any)._newVideoUrl = '';
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
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tr(locale, 'form.labels.city')}</FormLabel>
                      <Select onValueChange={(v) => {
                        field.onChange(v);
                        const c = cityCenter(v);
                        if (c) { setLat(c.lat); setLng(c.lng); }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tr(locale, 'home.cityPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {libyanCities.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{cityLabel(locale, c.value)}</SelectItem>
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

              <div className="space-y-3">
                <FormLabel>{tr(locale, 'form.labels.pickLocation')}</FormLabel>
                <AddressSearch
                  className="max-w-md"
                  placeholder={tr(locale, 'form.placeholders.searchAddress')}
                  countryCodes="ly"
                  city={String(form.getValues('city') || '')}
                  onSelect={({ lat, lng }) => {
                    setLat(Number(lat.toFixed(6)));
                    setLng(Number(lng.toFixed(6)));
                  }}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <FormLabel className="text-xs">{tr(locale, 'form.labels.latitude')}</FormLabel>
                    <Input
                      placeholder="e.g., 32.8872"
                      value={lat ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setLat(v === '' ? undefined : Number(v));
                      }}
                    />
                  </div>
                  <div>
                    <FormLabel className="text-xs">{tr(locale, 'form.labels.longitude')}</FormLabel>
                    <Input
                      placeholder="e.g., 13.1913"
                      value={lng ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setLng(v === '' ? undefined : Number(v));
                      }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUseMyLocation}
                    >
                      {tr(locale, 'form.actions.useMyLocation')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setLat(undefined);
                        setLng(undefined);
                      }}
                    >
                      {tr(locale, 'form.actions.clearLocation')}
                    </Button>
                  </div>
                </div>

                {/* Map picker (client-only) */}
                {mapMounted && (
                  <div className="h-64 w-full overflow-hidden rounded border">
                    <MapContainer
                      key={`${lat ?? 'city'}-${lng ?? 'city'}`}
                      center={(lat != null && lng != null)
                        ? [lat, lng]
                        : (() => { const c = cityCenter(String(form.getValues('city') || '')); return [c?.lat ?? 32.8872, c?.lng ?? 13.1913] as [number, number]; })()}
                      zoom={13}
                      className="h-full w-full cursor-crosshair"
                      scrollWheelZoom={true}
                      whenReady={(e: any) => {
                        // Ensure proper pane positions after mount/layout
                        setTimeout(() => e.target.invalidateSize(), 0);
                      }}
                      onClick={(e: any) => {
                        const { lat: la, lng: ln } = e.latlng || {};
                        if (typeof la === 'number' && typeof ln === 'number') {
                          setLat(Number(la.toFixed(6)));
                          setLng(Number(ln.toFixed(6)));
                        }
                      }}
                    >
                      <CenterWatcher />
                      <TileLayer attribution={tileAttrib} url={tileUrl} />
                      <ScaleControl position="bottomleft" />
                      {(lat != null && lng != null) && (
                        <Marker
                          position={[lat, lng] as any}
                          draggable={true}
                          icon={markerIcon as any}
                          eventHandlers={{
                            dragend: (e: any) => {
                              const p = e.target.getLatLng();
                              setLat(Number(p.lat.toFixed(6)));
                              setLng(Number(p.lng.toFixed(6)));
                            },
                          }}
                        >
                          <Popup>{tr(locale, 'form.map.selected')}</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      {lat != null && lng != null ? (
                        <span>{tr(locale, 'form.map.selected')}: {lat.toFixed(6)}, {lng.toFixed(6)}{selectedAddress ? ` — ${selectedAddress}` : ''}</span>
                      ) : (
                        <span>{tr(locale, 'form.map.clickToSet')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <FormLabel>{tr(locale, 'form.images.label')}</FormLabel>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAddFiles(Array.from(e.target.files ?? []))}
                    />
                    {tr(locale, 'form.images.addFiles')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={tr(locale, 'form.images.pasteUrlPlaceholder')}
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={handleAddUrl}>{tr(locale, 'form.images.addUrl')}</Button>
                  </div>
                </div>

                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {images.map((img, i) => (
                      <div key={i} className="relative overflow-hidden rounded border">
                        <Image
                          src={img.url}
                          alt={`Image ${i + 1}`}
                          width={400}
                          height={300}
                          className="aspect-video w-full object-cover"
                        />
                        <div className="flex items-center justify-between gap-2 p-2">
                          <div className="flex gap-1">
                            <Button type="button" variant="outline" size="sm" onClick={() => moveImage(i, -1)} disabled={i === 0}>{tr(locale, 'form.images.moveUp')}</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}>{tr(locale, 'form.images.moveDown')}</Button>
                          </div>
                          <div className="flex gap-1">
                            <input
                              id={`replace-file-${i}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleReplaceFile(i, f);
                                // allow selecting the same file again later
                                e.currentTarget.value = '';
                              }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`replace-file-${i}`)?.click()}>{tr(locale, 'form.images.replace')}</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => handleReplaceUrl(i)}>{tr(locale, 'form.images.replaceUrl')}</Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => removeImage(i)}>{tr(locale, 'form.images.remove')}</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{tr(locale, 'form.images.none')}</p>
                )}
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? tr(locale, 'dashboard.serviceForm.saving') : tr(locale, 'dashboard.serviceForm.saveChanges')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
