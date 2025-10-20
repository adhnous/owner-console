"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listServicesByProvider, requestServiceDelete, createService, type Service } from '@/lib/services';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getClientLocale, tr } from '@/lib/i18n';

export default function MyServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const locale = getClientLocale();

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await listServicesByProvider(user.uid);
        setServices(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleDelete = async (id?: string) => {
    if (!id) return;
    const ok = window.confirm(tr(locale, 'dashboard.services.confirmDelete'));
    if (!ok) return;
    try {
      const reason = window.prompt(locale === 'ar' ? 'سبب الحذف (اختياري):' : 'Reason for deletion (optional):') || undefined;
      await requestServiceDelete(id, reason);
      setServices(prev => prev.map(s => s.id === id ? { ...s, status: 'pending' as any, pendingDelete: true as any } : s));
      toast({ title: locale === 'ar' ? 'تم إرسال طلب الحذف للمراجعة' : 'Delete request submitted for review' });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('already_requested')) {
        toast({ title: locale === 'ar' ? 'طلب الحذف قيد المراجعة' : 'Delete request already pending' });
      } else {
        toast({ variant: 'destructive', title: tr(locale, 'dashboard.services.toast.deleteFailed'), description: err?.message || '' });
      }
    }
  };

  const seedSampleServices = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const samples: Omit<Service, 'id' | 'createdAt'>[] = [
        {
          title: 'Professional Plumbing Repairs & Installation',
          description: 'Experienced plumber available for repairs, installations, and emergency fixes. Fast, reliable, and affordable.',
          price: 150,
          category: 'Plumbing',
          city: 'Tripoli',
          area: 'Hay Al-Andalus',
          availabilityNote: 'Available from 9 AM to 6 PM',
          images: [{ url: 'https://placehold.co/800x600.png' }],
          contactPhone: '+218911234567',
          contactWhatsapp: '+218911234567',
          providerId: user.uid,
        },
        {
          title: 'Full House Cleaning Service',
          description: 'Thorough, professional home cleaning with your schedule in mind. Eco-friendly products on request.',
          price: 250,
          category: 'Home Services',
          city: 'Benghazi',
          area: 'Al-Sabri',
          availabilityNote: 'Weekdays and weekends',
          images: [{ url: 'https://placehold.co/800x600.png' }],
          contactPhone: '+218912345678',
          contactWhatsapp: '+218912345678',
          providerId: user.uid,
        },
        {
          title: 'Expert Car Mechanic for All Brands',
          description: 'Diagnostics, maintenance, and repairs for all makes and models. Mobile service available.',
          price: 200,
          category: 'Automotive',
          city: 'Misrata',
          area: 'City Center',
          availabilityNote: '9 AM - 8 PM',
          images: [{ url: 'https://placehold.co/800x600.png' }],
          contactPhone: '+218913456789',
          contactWhatsapp: '+218913456789',
          providerId: user.uid,
        },
      ];

      for (const s of samples) {
        await createService(s);
      }
      const data = await listServicesByProvider(user.uid);
      setServices(data);
      toast({ title: tr(locale, 'dashboard.services.toast.seeded') });
    } catch (err: any) {
      toast({ variant: 'destructive', title: tr(locale, 'dashboard.services.toast.seedFailed'), description: err?.message || '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{tr(locale, 'dashboard.services.title')}</CardTitle>
          <CardDescription>
            {tr(locale, 'dashboard.services.subtitle')}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/services/new">{tr(locale, 'dashboard.services.newService')}</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={seedSampleServices}>{tr(locale, 'dashboard.services.seedSamples')}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">{tr(locale, 'dashboard.services.loading')}</p>
        ) : services.length === 0 ? (
          <div className="text-muted-foreground">
            <p>{tr(locale, 'dashboard.services.emptyTitle')}</p>
            <Button asChild className="mt-3 mr-3">
              <Link href="/dashboard/services/new">{tr(locale, 'dashboard.services.createFirst')}</Link>
            </Button>
            <Button variant="outline" onClick={seedSampleServices} className="mt-3">{tr(locale, 'dashboard.services.seedSampleServices')}</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr(locale, 'dashboard.services.table.headers.title')}</TableHead>
                <TableHead>{tr(locale, 'dashboard.services.table.headers.category')}</TableHead>
                <TableHead>{tr(locale, 'dashboard.services.table.headers.city')}</TableHead>
                <TableHead>{tr(locale, 'dashboard.services.table.headers.price')}</TableHead>
                <TableHead>{tr(locale, 'dashboard.services.table.headers.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{service.title}</span>
                      {(((service as any).pendingDelete === true) || service.status === 'pending') && (
                        <Badge variant="destructive">{locale === 'ar' ? 'قيد الحذف' : 'Pending deletion'}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{service.category}</Badge>
                  </TableCell>
                  <TableCell>{service.city}</TableCell>
                  <TableCell>{service.price}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/services/${service.id}`}>{tr(locale, 'dashboard.services.actions.view')}</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/services/${service.id}/edit`}>{tr(locale, 'dashboard.services.actions.edit')}</Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(service.id)}
                      disabled={((service as any).pendingDelete === true) || service.status === 'pending'}
                    >
                      {tr(locale, 'dashboard.services.actions.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
