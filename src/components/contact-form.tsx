"use client";

import { useState } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getClientLocale } from '@/lib/i18n';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

type Errors = Partial<Record<'name' | 'email' | 'message', string>>;

export default function ContactForm() {
  const locale = getClientLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ name, email, message });
    if (!parsed.success) {
      const e: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Errors;
        e[k] = locale === 'ar' ? 'يرجى إدخال قيمة صحيحة.' : 'Please enter a valid value.';
      }
      setErrors(e);
      return;
    }

    try {
      setSending(true);
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error('send_failed');
      setSent(true);
      setName(''); setEmail(''); setMessage('');
    } catch (_) {
      alert(locale === 'ar' ? 'تعذر إرسال الرسالة.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="text-green-600">{locale === 'ar' ? 'تم إرسال رسالتك. سنعود إليك قريبًا.' : 'Your message has been sent. We will get back to you soon.'}</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">{locale === 'ar' ? 'الاسم' : 'Name'}</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required aria-invalid={!!errors.name} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-invalid={!!errors.email} />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>
      <div>
        <Label htmlFor="message">{locale === 'ar' ? 'رسالتك' : 'Your Message'}</Label>
        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} aria-invalid={!!errors.message} />
        {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
      </div>
      <Button type="submit" disabled={sending}>{sending ? (locale === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (locale === 'ar' ? 'إرسال' : 'Send')}</Button>
    </form>
  );
}
