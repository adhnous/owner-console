"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateUserProfile } from '@/lib/user';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { tr, getClientLocale } from '@/lib/i18n';

export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const locale = getClientLocale();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(String(userProfile?.displayName || ''));
    setPhone(String((userProfile as any)?.phone || ''));
    setWhatsapp(String((userProfile as any)?.whatsapp || ''));
    setCity(String((userProfile as any)?.city || ''));
  }, [userProfile?.displayName, (userProfile as any)?.phone, (userProfile as any)?.whatsapp, (userProfile as any)?.city]);

  const onSave = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      setSaving(true);
      await updateUserProfile(user.uid, {
        displayName: name?.trim() || undefined,
        // Store empty values as nulls so Firestore fields are cleaned up
        ...(phone.trim() !== '' ? { phone: phone.trim() } : { phone: null }),
        ...(whatsapp.trim() !== '' ? { whatsapp: whatsapp.trim() } : { whatsapp: null }),
        ...(city.trim() !== '' ? { city: city.trim() } : { city: null }),
      });
      toast({ title: 'Saved', description: 'Your profile has been updated.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e?.message || 'Could not update profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ds-card">
      <div className="ds-card-section">
        <h1 className="ds-section-title">{tr(locale, 'header.profile')}</h1>
        <p className="ds-section-subtitle">
          {locale === 'ar' ? 'حدّث معلوماتك الشخصية وبيانات التواصل.' : 'Update your personal and contact information.'}
        </p>
      </div>
      <div className="ds-card-section grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">{locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="ds-input" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">{tr(locale, 'form.labels.contactPhone')}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={locale === 'ar' ? 'مثال: 091 234 5678' : 'e.g., 091 234 5678'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="ds-input"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="whatsapp">{tr(locale, 'form.labels.contactWhatsapp')}</Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={locale === 'ar' ? 'مثال: +218 91 234 5678' : 'e.g., +218 91 234 5678'}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="ds-input"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">{tr(locale, 'form.labels.city')}</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" className="ds-input" />
        </div>
        <div>
          <button onClick={onSave} disabled={saving} className="ds-btn ds-btn-primary">
            {saving ? tr(locale, 'dashboard.serviceForm.saving') : tr(locale, 'dashboard.serviceForm.saveChanges')}
          </button>
        </div>
      </div>
    </section>
  );
}

