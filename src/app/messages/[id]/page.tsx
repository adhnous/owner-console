'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getClientLocale, tr } from '@/lib/i18n';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { subscribeMessages, sendMessage, type Message } from '@/lib/chat';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const locale = getClientLocale();

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const convId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  useEffect(() => {
    if (!convId) return;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'conversations', convId);
        const snap = await getDoc(ref);
        if (!snap.exists()) { setNotAllowed(true); setLoading(false); return; }
        const data = snap.data() as any;
        setServiceId(data.serviceId || null);
        // Basic client-side access check (rules also enforce): ensure I am a participant
        const parts = (data.participants || {}) as Record<string, boolean>;
        if (!user || !parts[user.uid]) { setNotAllowed(true); setLoading(false); return; }
        setNotAllowed(false);
        unsubscribe = subscribeMessages(convId, (rows) => {
          setMessages(rows);
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
        });
        setLoading(false);
      } catch {
        setNotAllowed(true);
        setLoading(false);
      }
    })();
    return () => { try { unsubscribe && unsubscribe(); } catch {} };
  }, [convId, user?.uid]);

  async function handleSend() {
    if (!user || !convId || !text.trim()) return;
    await sendMessage(convId, user.uid, text);
    // Track message_sent if we know the service
    if (serviceId) {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message_sent', serviceId, city: null, ref: null }),
      }).catch(() => {});
    }
    setText('');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container flex-1 py-6 md:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold">{tr(locale, 'chat.title')}</h1>
            {serviceId && (
              <Button variant="outline" onClick={() => router.push(`/services/${serviceId}`)}>
                {tr(locale, 'details.goHome')}
              </Button>
            )}
          </div>

          {!user && (
            <div className="rounded border bg-background p-4 text-sm text-muted-foreground">
              {tr(locale, 'chat.signInPrompt')}
            </div>
          )}
          {user && notAllowed && (
            <div className="rounded border bg-background p-4 text-sm text-muted-foreground">
              {tr(locale, 'chat.notAllowed')}
            </div>
          )}

          {user && !notAllowed && (
            <>
              <div ref={listRef} className="h-[60vh] w-full overflow-y-auto rounded border bg-background p-3">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{tr(locale, 'chat.empty')}</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((m) => {
                      const mine = m.senderId === user?.uid;
                      return (
                        <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${mine ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-secondary'}`}>
                          {m.text}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={tr(locale, 'chat.typeMessage')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <Button onClick={handleSend} disabled={!text.trim()}>
                  {tr(locale, 'chat.send')}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
