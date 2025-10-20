"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import Link from "next/link";
import { getClientLocale } from "@/lib/i18n";

export type AdItem = {
  id: string;
  text: string;
  textAr?: string | null;
  href?: string | null;
  color?: "copper" | "power" | "dark" | "light";
  active?: boolean;
  priority?: number;
};

export default function AdStrip() {
  const [ads, setAds] = useState<AdItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "ads"),
      where("active", "==", true),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const next: AdItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as any;
        const rawColor: string | undefined = typeof d?.color === 'string' ? d.color : undefined;
        const allowed = ["copper", "power", "dark", "light"] as const;
        const color: AdItem["color"] = (rawColor && (allowed as readonly string[]).includes(rawColor))
          ? (rawColor as AdItem["color"]) : ("copper" as const);
        next.push({
          id: doc.id,
          text: String(d?.text ?? ""),
          textAr: d?.textAr || null,
          href: d?.href || null,
          color,
          active: !!d?.active,
          priority: typeof d?.priority === 'number' ? d.priority : Number(d?.priority) || 0,
        });
      });
      // Sort client-side by priority desc
      next.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      setAds(next);
    }, (err) => {
      console.warn('[AdStrip] ads snapshot error:', err);
      setAds([]);
    });
    return () => unsub();
  }, []);

  const locale = getClientLocale();
  const isRtl = locale === 'ar';

  const items = useMemo(() => {
    if (ads.length > 0) return ads;
    // Fallback demo when no ads exist
    return [
      { 
        id: "demo-1", 
        text: "Advertise your service to thousands of users.", 
        textAr: "أعلن عن خدمتك لآلاف المستخدمين.", 
        href: "/dashboard/services", 
        color: "copper" as const 
      },
    ];
  }, [ads]);

  // Build sequences for seamless loop - FIXED: Use proper duplication for animation
  const sequences = useMemo(() => {
    if (items.length === 0) return [];
    
    // For smooth animation, we need enough content to loop
    const MIN_ITEMS = 8;
    const repeats = Math.ceil(MIN_ITEMS / Math.max(items.length, 1));
    const baseSequence: AdItem[] = [];
    
    for (let i = 0; i < repeats; i++) {
      baseSequence.push(...items);
    }
    
    return baseSequence;
  }, [items]);

  useEffect(() => {
    const updateVar = () => {
      try {
        const h = rootRef.current?.offsetHeight ?? 0;
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--ad-height', `${h}px`);
        }
      } catch {}
    };
    updateVar();
    window.addEventListener('resize', updateVar);
    return () => window.removeEventListener('resize', updateVar);
  }, [sequences.length, items.length]);

  if (items.length === 0) return null;

  function getBackgroundColor(color?: AdItem["color"]) {
    switch (color) {
      case "power": return "bg-power text-snow";
      case "dark": return "bg-ink text-snow";
      case "light": return "bg-snow text-ink border";
      default: return "bg-copper text-ink"; // copper
    }
  }

  const shouldBounce = sequences.length <= 4; // Use bounce animation for fewer items

  return (
    <div ref={rootRef} className={`ad-marquee ${getBackgroundColor(items[0]?.color)}`}>
      {/* Fixed: Removed container and fixed layout for animation */}
      <div className={`ad-track ${shouldBounce ? 'single' : ''}`}>
        {/* Sequence A - visible */}
        <div className="ad-seq">
          {sequences.map((ad, idx) => (
            <AdBadge key={`seq-a-${ad.id}-${idx}`} ad={ad} />
          ))}
        </div>
        
        {/* Sequence B - duplicate for seamless loop (only for scroll animation) */}
        {!shouldBounce && (
          <div className="ad-seq" aria-hidden="true">
            {sequences.map((ad, idx) => (
              <AdBadge key={`seq-b-${ad.id}-${idx}`} ad={ad} />
            ))}
          </div>
        )}
      </div>
      
      {/* Fixed: Absolutely positioned advertise link */}
      <Link 
        href="/dashboard" 
        className={`absolute ${isRtl ? 'left-4 right-auto' : 'right-4 left-auto'} top-1/2 -translate-y-1/2 rounded px-3 py-1 text-xs bg-ink text-snow hover:opacity-90 z-10`}
      >
        {locale === 'ar' ? 'أعلن معنا' : 'Advertise with us'}
      </Link>
    </div>
  );
}

function AdBadge({ ad }: { ad: AdItem }) {
  const locale = getClientLocale();
  const label = (locale === 'ar' ? (ad.textAr || ad.text) : ad.text) || '';
  
  const content = (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-ink backdrop-blur-sm border border-ink/10 whitespace-nowrap">
      <span className="text-xs font-bold shrink-0">{locale === 'ar' ? 'إعلان' : 'Ad'}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );

  if (ad.href) {
    return (
      <Link href={ad.href} className="mx-2 inline-block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  
  return <span className="mx-2 inline-block">{content}</span>;
}